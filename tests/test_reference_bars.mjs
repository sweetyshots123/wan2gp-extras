import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = fs.readFileSync(new URL('../extras.js', import.meta.url), 'utf8');
const list = (...values) => {
    const s = new Set(values); let changes = 0;
    return {contains: k => s.has(k), add: k => s.add(k), remove: k => s.delete(k),
        toggle: (k, v) => {changes++; return v ? s.add(k) : s.delete(k);}, changes: () => changes};
};
const el = (parent, ...classes) => ({parentElement: parent, classList: list(...classes), hidden: false,
    display: 'block', visibility: 'visible', getAttribute: () => null});
const body = el(null), tab = el(body, 'tabitem'), group = el(tab), row = el(group), editRow = el(tab);
const bar = el(tab), editBar = el(tab), vbar = el(tab), start = el(tab), end = el(tab);
bar.classList.add('some-other-plugin-class');
let rows = {generate: row, edit: editRow}, bars = {reflib_bar_generate: bar, reflib_bar_edit: editBar,
    reflib_vbar_generate: vbar, image_start: start, image_end: end};
const docEvents = {}, windowEvents = {}, intervals = [], frames = [], styles = [];
let observer, clicks = 0, pushes = 0;
const generate = {textContent: 'Generate', offsetParent: {}, disabled: false, visibility: 'visible', style: {}, click: () => clicks++};
const queue = {textContent: 'Add New Prompt To Queue', offsetParent: {}, disabled: false, visibility: 'visible', style: {}, click: () => clicks++};
const window = {addEventListener: (n, f) => (windowEvents[n] ||= []).push(f)};
const doc = {body, head: {appendChild: e => styles.push(e)}, activeElement: null,
    createElement: () => ({}), addEventListener: (n, f) => (docEvents[n] ||= []).push(f),
    querySelectorAll: selector => selector === 'button' ? [generate, queue] : [],
    querySelector: selector => rows[selector.replace('.extras-refs-row-', '')] || null,
    getElementById: id => bars[id] || null};
const ctx = vm.createContext({window, document: doc, console: {log(){}, warn(){}},
    location: {href: 'http://synthetic.test'}, history: {state: null, pushState(){ pushes++; }},
    Event: class {constructor(type){this.type=type;}},
    getComputedStyle: x => ({display: x.display || 'block', visibility: x.visibility || 'visible'}),
    setTimeout: fn => fn(), setInterval: fn => intervals.push(fn),
    requestAnimationFrame: fn => frames.push(fn),
    MutationObserver: class {constructor(fn){observer=fn;} observe(){}}});
vm.runInContext(src, ctx);
const tick = () => {for(const f of intervals) f(); while(frames.length) frames.shift()();};
const hidden = (b=bar) => b.classList.contains('extras-refs-unavailable');
assert(!hidden()); row.classList.add('hidden'); observer(); tick(); assert(hidden());
assert(!hidden(editBar)); assert(!hidden(vbar)); assert(!hidden(start)); assert(!hidden(end));
assert(bar.classList.contains('some-other-plugin-class'));
const changes = bar.classList.changes(); tick(); tick(); assert.equal(bar.classList.changes(), changes); // no observer loop
row.classList.remove('hidden'); row.display='none'; tick(); assert(hidden());
row.display='block'; row.hidden=true; tick(); assert(hidden()); row.hidden=false;
group.visibility='hidden'; tick(); assert(hidden()); group.visibility='visible'; tick(); assert(!hidden());
group.classList.add('hidden'); tick(); assert(hidden()); group.classList.remove('hidden');
tab.display='none'; tab.hidden=true; tick(); assert(!hidden()); // inactive tab is not model support
rows.generate=null; tick(); assert(!hidden()); // unknown integration: restore only our own class
rows.generate=row; row.hidden=true; tick(); assert(hidden());
const replacement=el(tab); bars.reflib_bar_generate=replacement; tick(); assert(hidden(replacement));
row.hidden=false; tick(); assert(!hidden(replacement));
bars={}; tick(); // RL absent is harmless
// Existing shortcut: Generate first, then Queue if Generate isn't visible; input is flushed first.
let flushed=[]; doc.activeElement={tagName:'TEXTAREA',dispatchEvent:e=>flushed.push(e.type),blur:()=>flushed.push('blur')};
const event = values => ({preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values});
const key=event({key:'Enter',ctrlKey:true});docEvents.keydown[0](key);
assert.equal(clicks,1);assert(key.prevented);assert.deepEqual(flushed,['input','change','blur']);
generate.offsetParent=null;docEvents.keydown[0](event({key:'Enter',metaKey:true}));assert.equal(clicks,2);
docEvents.keydown[0](event({key:'Enter',ctrlKey:true,repeat:true}));assert.equal(clicks,2);
for(const name of ['mousedown','mouseup','auxclick','pointerdown','pointerup']){
 const e=event({button:3});windowEvents[name][0](e);assert(e.prevented);
}
const back=event({key:'BrowserBack'});windowEvents.keydown[0](back);assert(back.prevented);
assert.equal(pushes,1); windowEvents.popstate[0]({state:null}); assert.equal(pushes,2);
const counts=[docEvents.keydown.length,intervals.length,styles.length];vm.runInContext(src,ctx);
assert.deepEqual([docEvents.keydown.length,intervals.length,styles.length],counts);
console.log('Extras: native visibility/restore/recreation/unknown row + reference-only targeting + Ctrl/Cmd+Enter + navigation + idempotence OK');
