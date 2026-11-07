import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {audit,root,pages} from './check.mjs';

export const productionUrl = 'https://nhadd.github.io/leonarddacpano/';
const publicDirectories = ['assets','cv','pfp','pp'];
const extensionAllowlist = new Set(['.html','.css','.js','.svg','.jpg','.jpeg','.png','.webp','.gif','.avif','.ico','.woff','.woff2','.ttf','.otf','.pdf','.docx']);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /["']type["']\s*:\s*["']service_account["']/,
  /["'](?:private_key|client_secret|refresh_token)["']\s*:\s*["'][^"']+["']/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/
];

function listFiles(directory,prefix='',output=[]) {
  for(const item of fs.readdirSync(directory,{withFileTypes:true})) {
    const relative=prefix+item.name;
    const full=path.join(directory,item.name);
    const info=fs.lstatSync(full);
    if(info.isSymbolicLink()) throw new Error('Links are not allowed in the Pages artifact: '+relative);
    if(item.isDirectory())listFiles(full,relative+'/',output);
    else if(item.isFile())output.push(relative);
    else throw new Error('Unsupported artifact entry: '+relative);
  }
  return output;
}

export function verifyPages(base=path.join(root,'dist')) {
  base=path.resolve(base);
  const result=audit(base);
  if(result.errors.length)throw new Error(result.errors.join('\n'));
  const files=listFiles(base);
  const fileSet=new Set(files);
  const expected=new Set([...pages,'.nojekyll','.portfolio-build']);
  for(const directory of publicDirectories)for(const file of listFiles(path.join(root,directory)))expected.add(directory+'/'+file);
  for(const file of files) {
    if(!expected.has(file))throw new Error('Unexpected file in public output: '+file);
    if(file.startsWith('.')) {
      if(!['.nojekyll','.portfolio-build'].includes(file))throw new Error('Unexpected hidden output: '+file);
    } else if(!extensionAllowlist.has(path.extname(file).toLowerCase()))throw new Error('Unsupported public file type: '+file);
    if(/(^|\/)(?:\.env(?:\..*)?|\.git|node_modules|firebase|test|scripts|.*service[-_]?account.*|.*credentials.*)$/i.test(file))throw new Error('Private/source file in public output: '+file);
    if(/\.(html|css|js|svg)$/i.test(file)) {
      const text=fs.readFileSync(path.join(base,file),'utf8');
      if(secretPatterns.some(pattern=>pattern.test(text)))throw new Error('Potential private credential in public output: '+file);
      if(text.includes('https://nhadd.github.io/Port.Main/'))throw new Error('Old production URL remains in '+file);
    }
  }
  for(const file of expected)if(!fileSet.has(file))throw new Error('Missing public output: '+file);
  const target=new URL(productionUrl);
  let checkedReferences=0;
  function checkReference(value,from) {
    if(!value || /^(?:data:|mailto:|tel:)/i.test(value))return;
    if(value.startsWith('/') || value.startsWith('\\'))throw new Error('Root-relative reference in '+from+': '+value);
    const resolved=new URL(value,new URL(from,productionUrl));
    if(resolved.origin!==target.origin)return;
    if(!resolved.pathname.startsWith(target.pathname))throw new Error('Reference escapes /Port.Main/: '+value+' in '+from);
    const relative=decodeURIComponent(resolved.pathname.slice(target.pathname.length)) || 'index.html';
    const name=relative.endsWith('/')?relative+'index.html':relative;
    if(!fileSet.has(name))throw new Error('Missing referenced file: '+name+' from '+from);
    checkedReferences++;
  }
  for(const file of files) {
    const extension=path.extname(file);
    if(!['.html','.css','.js'].includes(extension))continue;
    const text=fs.readFileSync(path.join(base,file),'utf8');
    if(extension==='.html') {
      for(const match of text.matchAll(/<(?:a|link|img|script|form)\b[^>]*?\b(?:href|src|action)="([^"]+)"/g))checkReference(match[1],file);
      for(const match of text.matchAll(/<meta\b[^>]*property="og:(?:url|image)"[^>]*content="([^"]+)"/g))checkReference(match[1],file);
      if(file!=='admin.html') {
        const canonical=text.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
        const expectedUrl=new URL(file==='index.html'?'':file,productionUrl).href;
        if(canonical!==expectedUrl)throw new Error('Incorrect canonical URL in '+file);
      }
    }
    if(extension==='.css')for(const match of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g))checkReference(match[1],file);
    if(extension==='.js') {
      for(const match of text.matchAll(/\b(?:import|export)\s+(?:[^'";\n]+?\s+from\s+)?['"](\.[^'"]+)['"]/g))checkReference(match[1],file);
      for(const match of text.matchAll(/new URL\(\s*['"](\.[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g))checkReference(match[1],file);
    }
  }
  return {productionUrl,pages:pages.length,files:files.length,htmlReferences:result.references,checkedReferences};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { console.log('PASS Pages artifact: '+JSON.stringify(verifyPages())); }
  catch(error) {console.error(error.message);process.exitCode=1;}
}
