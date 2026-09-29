import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('page stylesheet is CSS and retains the dark viewport layout',async()=>{
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/<(?:!doctype|html|head|body|script)\b/i);
 assert.match(css,/:root\s*\{[^}]*color-scheme:dark/);
 assert.match(css,/#viewport\s*\{[^}]*min-height:/);
 assert.match(css,/\.generation-section\s*\{/);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<link[^>]+href="\.\/style\.css"/);
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 for(const [,id] of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),`Missing page element: ${id}`);
});
