import json, re, sys
src = open('/tmp/claude-0/v416/showcase_kascity_v416.html', encoding='utf-8').read()
lines = src.split('\n')
L = 14207
line = lines[L]
a = line.index('loadScene)(') + len('loadScene)(')
dec = json.JSONDecoder()
js, end = dec.raw_decode(line[a:])
sc = json.loads(js)
R = sc['resources']
R['meshes'].update({
  'walkRow':  {'type': 'box', 'size': [19.88, 0.05, 1.74]},
  'walkCol':  {'type': 'box', 'size': [1.74, 0.05, 16.4]},
  'curbRow':  {'type': 'box', 'size': [16.5, 0.16, 0.14]},
  'edgeRow':  {'type': 'box', 'size': [19.88, 0.06, 0.06]},
  'curbCol':  {'type': 'box', 'size': [0.14, 0.16, 16.5]},
  'edgeCol':  {'type': 'box', 'size': [0.06, 0.06, 19.88]},
  'signPost': {'type': 'box', 'size': [0.07, 1.05, 0.07]},
  'signRow':  {'type': 'box', 'size': [0.95, 0.30, 0.05]},
  'signCol':  {'type': 'box', 'size': [0.05, 0.30, 0.95]},
})
R['materials'].update({
  'walk':   {'color': '#cfcac0'},
  'curb':   {'color': '#55504a'},
  'gutter': {'color': '#3d3a35'},
  'post':   {'color': '#5b5f66'},
  'signG':  {'color': '#2f7d46'},
})
W = 9.07            # sidewalk centre (strip 8.2..9.94, between the lots and the green)
C = 8.2             # curb line, street side
def tilepos(t):
    if t == 0: return (11, 11)
    if t < 10: return (11 - 2.2 * t, 11)
    if t == 10: return (-11, 11)
    if t < 20: return (-11, 11 - 2.2 * (t - 10))
    if t == 20: return (-11, -11)
    if t < 30: return (-11 + 2.2 * (t - 20), -11)
    if t == 30: return (11, -11)
    return (11, -11 + 2.2 * (t - 30))
nodes = []
for sgn in (1, -1):   # one continuous sidewalk + curb per side (scene node cap is 512)
    nodes.append({'id': 'walk_r%d' % sgn, 'mesh': 'walkRow', 'material': 'walk', 'transform': {'pos': [0, 0.08, W * sgn]}})
    nodes.append({'id': 'walk_c%d' % sgn, 'mesh': 'walkCol', 'material': 'walk', 'transform': {'pos': [W * sgn, 0.08, 0]}})
    nodes.append({'id': 'curb_r%d' % sgn, 'mesh': 'curbRow', 'material': 'curb', 'transform': {'pos': [0, 0.11, C * sgn]}})
    nodes.append({'id': 'edge_r%d' % sgn, 'mesh': 'edgeRow', 'material': 'gutter', 'transform': {'pos': [0, 0.1, 9.93 * sgn]}})
    nodes.append({'id': 'curb_c%d' % sgn, 'mesh': 'curbCol', 'material': 'curb', 'transform': {'pos': [C * sgn, 0.11, 0]}})
    nodes.append({'id': 'edge_c%d' % sgn, 'mesh': 'edgeCol', 'material': 'gutter', 'transform': {'pos': [9.93 * sgn, 0.1, 0]}})
# one street sign per district at its first lot; the plate switches colour when the block is completed
D = [[1,3],[6,8,9],[11,13,14],[16,18,19],[21,23,24],[26,27,29],[31,32,34],[37,39]]
for g, tiles in enumerate(D):
    t = tiles[0]; x, z = tilepos(t)
    if abs(z) == 11:                       # bottom row: index grows toward -x; top row toward +x
        d = -1 if z > 0 else 1
        post = [round(x + 1.1 * d, 3), 0.62, round((C + 0.12) * (1 if z > 0 else -1), 3)]; pm = 'signRow'
    else:                                  # left column: index grows toward -z; right column toward +z
        d = -1 if x < 0 else 1
        post = [round((C + 0.12) * (1 if x > 0 else -1), 3), 0.62, round(z + 1.1 * d, 3)]; pm = 'signCol'
    nodes.append({'id': 'signpost_%d' % g, 'mesh': 'signPost', 'material': 'post', 'transform': {'pos': post},
                  'children': [{'id': 'sign_%d' % g, 'mesh': pm, 'material': 'signG', 'transform': {'pos': [0, 0.43, 0]}}]})
# insert before the first token so draw order keeps tokens on top
idx = next(i for i, n in enumerate(sc['nodes']) if n.get('id') == 'token_p1')
sc['nodes'][idx:idx] = nodes
new_js = json.dumps(json.dumps(sc, separators=(',', ':')))
lines[L] = line[:a] + new_js + line[a + end:]
out = '\n'.join(lines)
# YOU marker follows the visible piece, not the token centre
old_m = 'var n=window.KV_NODE("token_p"+p);\n        if(!n||!n.worldPos){ d.style.display="none"; continue; }'
assert out.count(old_m) == 1, out.count(old_m)
out = out.replace(old_m, 'var n=window.KV_NODE("tok_spr_"+p)||window.KV_NODE("token_p"+p);   // __KV_V417: marker follows the piece on the sidewalk\n        if(!n||!n.worldPos){ d.style.display="none"; continue; }')
old_t = "var h=\"<div style='font:900 26px Impact,sans-serif;color:#f0c860;letter-spacing:2px;margin-bottom:8px'>ROLL FOR FIRST</div>\";"
assert out.count(old_t) == 1, ('title', out.count(old_t))
out = out.replace(old_t, "var h=\"<div style='font:900 26px Impact,sans-serif;color:#f0c860;letter-spacing:2px;margin-bottom:8px'>\"+((window.KV_MP2&&window.KV_MP2.room)?\"WHO GOES FIRST\":\"ROLL FOR FIRST\")+\"</div>\";   // __KV_V417")
old_w = 'render("P"+s+" — waiting for the host\'s throw…");'
assert out.count(old_w) == 1, ('wait', out.count(old_w))
out = out.replace(old_w, 'render("waiting for P"+s+"\'s roll…"); /* __KV_V417: a remote seat may be a person, not the host */')
old_f = 'render("P"+s+" — from the host…");'
assert out.count(old_f) == 1, ('from', out.count(old_f))
out = out.replace(old_f, 'render("P"+s+" rolled");')
runtime = open('/tmp/claude-0/v417/v417_runtime.js', encoding='utf-8').read()
out = out.replace('</body>', '<script>\n' + runtime + '\n</script>\n</body>', 1) if '</body>' in out else out + '\n<script>\n' + runtime + '\n</script>\n'
out = out.replace('KasCity console ready [v416: scenarios are chain events — post-roll only, no timer cards in MP (KV_V416)]',
                  'KasCity console ready [v417: sidewalk + district street signs, slim roll-off banner (KV_V417)]')
open('/tmp/claude-0/v417/showcase_kascity_v417.html', 'w', encoding='utf-8').write(out)
print('built', len(nodes), 'scene nodes added')
