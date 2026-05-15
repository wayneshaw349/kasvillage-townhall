// LocalServer.ts
// Production local HTTP server for Same WiFi P2P
// Deep link signing, proper error handling

import { Platform, Linking } from 'react-native';
// Inline type to avoid circular dependency
interface BalanceSheet {
  id: string;
  partyA: { pubkey: string; address: string; alias?: string };
  partyB: { pubkey: string; address: string; alias?: string };
  netBalance: string;
  signatures: { partyA?: string; partyB?: string };
}

// =============================================================================
// TYPES
// =============================================================================

interface SignatureCallback {
  (pubkey: string, signature: string): void;
}

interface ServerConfig {
  port: number;
  onSignature?: SignatureCallback;
  onError?: (error: Error) => void;
}

// =============================================================================
// GET LOCAL IP
// =============================================================================

export async function getLocalIP(): Promise<string | null> {
  const methods = [
    async () => {
      let NetworkInfo: any; try { NetworkInfo = require('react-native-network-info').NetworkInfo; } catch { NetworkInfo = null; }
      return await NetworkInfo.getIPV4Address();
    },
    async () => {
      const Network = require('expo-network');
      return await Network.getIpAddressAsync();
    },
  ];
  
  for (const method of methods) {
    try {
      const ip = await method();
      if (ip && !ip.startsWith('127.') && ip !== '0.0.0.0') {
        return ip;
      }
    } catch (e) {}
  }
  
  return null;
}

// =============================================================================
// LOCAL P2P SERVER
// =============================================================================

export class LocalP2PServer {
  private server: any = null;
  private config: ServerConfig;
  private sheet: BalanceSheet | null = null;
  private running = false;
  private serverIP: string = 'localhost';
  
  constructor(config: ServerConfig | number) {
    this.config = typeof config === 'number' ? { port: config } : config;
  }
  
  async start(): Promise<void> {
    if (this.running) return;
    
    // Get IP before starting
    const ip = await getLocalIP();
    if (ip) this.serverIP = ip;
    
    const TcpSocket = require('react-native-tcp-socket').default;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
      
      this.server = TcpSocket.createServer((socket: any) => {
        let buffer = '';
        
        socket.on('data', (chunk: Uint8Array | string) => {
          buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
          
          const headerEnd = buffer.indexOf('\r\n\r\n');
          if (headerEnd === -1) return;
          
          const headers = buffer.slice(0, headerEnd);
          const contentLengthMatch = headers.match(/Content-Length: (\d+)/i);
          const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0;
          
          const bodyStart = headerEnd + 4;
          const body = buffer.slice(bodyStart);
          
          if (body.length < contentLength) return;
          
          this.handleRequest(buffer, socket);
          buffer = '';
        });
        
        socket.on('error', (err: Error) => console.error('[LocalServer] Socket error:', err.message));
        socket.on('close', () => {});
      });
      
      this.server.on('error', (err: Error) => {
        clearTimeout(timeout);
        this.config.onError?.(err);
        reject(err);
      });
      
      this.server.listen({ port: this.config.port, host: '0.0.0.0' }, () => {
        clearTimeout(timeout);
        this.running = true;
        console.log(`[LocalServer] Listening on port ${this.config.port}`);
        resolve();
      });
    });
  }
  
  stop(): void {
    if (this.server) { this.server.close(); this.server = null; }
    this.running = false;
    this.sheet = null;
  }
  
  setBalanceSheet(sheet: BalanceSheet): void { this.sheet = sheet; }
  onSignature(callback: SignatureCallback): void { this.config.onSignature = callback; }
  
  protected handleRequest(raw: string, socket: any): void {
    const [requestLine] = raw.split('\r\n');
    const [method, path] = requestLine.split(' ');
    
    const cors = [
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Methods: GET, POST, OPTIONS',
      'Access-Control-Allow-Headers: Content-Type',
    ].join('\r\n');
    
    if (method === 'OPTIONS') { this.respond(socket, 204, '', cors); return; }
    
    if (method === 'GET' && path.startsWith('/sheet/')) {
      if (!this.sheet) { this.respond(socket, 404, 'No sheet', cors); return; }
      const html = this.renderHTML(this.sheet);
      this.respond(socket, 200, html, `${cors}\r\nContent-Type: text/html; charset=utf-8`);
      return;
    }
    
    if (method === 'GET' && path.startsWith('/api/sheet/')) {
      if (!this.sheet) { this.respond(socket, 404, '{"error":"Not found"}', `${cors}\r\nContent-Type: application/json`); return; }
      this.respond(socket, 200, JSON.stringify(this.sheet), `${cors}\r\nContent-Type: application/json`);
      return;
    }
    
    if (method === 'POST' && path.includes('/sign')) {
      const bodyStart = raw.indexOf('\r\n\r\n') + 4;
      const body = raw.slice(bodyStart);
      
      try {
        const { pubkey, signature } = JSON.parse(body);
        
        if (!pubkey || !signature) {
          this.respond(socket, 400, '{"error":"Missing fields"}', `${cors}\r\nContent-Type: application/json`);
          return;
        }
        if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
          this.respond(socket, 400, '{"error":"Invalid pubkey format"}', `${cors}\r\nContent-Type: application/json`);
          return;
        }
        if (!/^[0-9a-fA-F]{128}$/.test(signature)) {
          this.respond(socket, 400, '{"error":"Invalid signature format"}', `${cors}\r\nContent-Type: application/json`);
          return;
        }
        
        if (this.sheet) {
          if (pubkey === this.sheet.partyA.pubkey) this.sheet.signatures.partyA = signature;
          else if (pubkey === this.sheet.partyB.pubkey) this.sheet.signatures.partyB = signature;
        }
        
        this.config.onSignature?.(pubkey, signature);
        this.respond(socket, 200, '{"success":true}', `${cors}\r\nContent-Type: application/json`);
      } catch (e) {
        this.respond(socket, 400, '{"error":"Invalid JSON"}', `${cors}\r\nContent-Type: application/json`);
      }
      return;
    }
    
    this.respond(socket, 404, 'Not Found', cors);
  }
  
  private respond(socket: any, status: number, body: string, headers: string): void {
    const statusText: Record<number, string> = { 200: 'OK', 204: 'No Content', 400: 'Bad Request', 404: 'Not Found' };
    
    const bodyBytes = new TextEncoder().encode(body);
    const response = [
      `HTTP/1.1 ${status} ${statusText[status] || 'Error'}`,
      headers,
      `Content-Length: ${bodyBytes.length}`,
      'Connection: close',
      '',
      '',
    ].join('\r\n');
    
    socket.write(new TextEncoder().encode(response));
    socket.write(bodyBytes);
    socket.destroy();
  }
  
  private renderHTML(sheet: BalanceSheet): string {
    const net = (Number(sheet.netBalance) / 1e8).toFixed(8);
    const absNet = Math.abs(Number(net));
    const aOwesB = BigInt(sheet.netBalance) >= 0;
    const direction = aOwesB
      ? `${sheet.partyA.alias || 'Party A'} owes ${sheet.partyB.alias || 'Party B'}`
      : `${sheet.partyB.alias || 'Party B'} owes ${sheet.partyA.alias || 'Party A'}`;
    
    const sigA = sheet.signatures.partyA ? '✓ Signed' : '⏳ Pending';
    const sigB = sheet.signatures.partyB ? '✓ Signed' : '⏳ Pending';
    
    const deepLink = `kasvillage://sign-sheet?id=${encodeURIComponent(sheet.id)}&callback=${encodeURIComponent(
      `http://${this.serverIP}:${this.config.port}/api/sheet/${sheet.id}/sign`
    )}`;
    
    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Sign Balance Sheet</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#1a1a2e;color:#fff;padding:20px;min-height:100vh}
.c{max-width:400px;margin:0 auto}
.logo{text-align:center;font-size:48px;margin-bottom:8px}
h1{text-align:center;color:#49d6aa;font-size:20px;margin-bottom:24px}
.box{background:#16213e;border-radius:12px;padding:20px;margin-bottom:16px}
.label{color:#888;font-size:11px;text-transform:uppercase;margin-bottom:4px}
.value{color:#fff;font-size:14px;word-break:break-all}
.balance{text-align:center}
.amount{font-size:32px;font-weight:bold;color:#49d6aa}
.direction{color:#888;font-size:13px;margin-top:4px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.party{background:#16213e;border-radius:8px;padding:12px}
.sig{margin-top:8px;font-size:12px}
.sig.ok{color:#2ecc71}
.sig.wait{color:#f39c12}
.btn{display:block;width:100%;background:#49d6aa;color:#1a1a2e;border:none;border-radius:8px;padding:16px;font-size:16px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;margin-bottom:12px}
.btn:active{opacity:0.9}
.btn.sec{background:#16213e;color:#49d6aa;border:1px solid #49d6aa}
.note{background:#0f0f1a;border-left:3px solid #2ecc71;padding:12px;font-size:12px;color:#888;line-height:1.5}
#status{text-align:center;padding:12px;border-radius:8px;margin-bottom:16px;display:none}
#status.show{display:block}
#status.ok{background:rgba(46,204,113,0.2);color:#2ecc71}
#status.err{background:rgba(231,76,60,0.2);color:#e74c3c}
#status.info{background:rgba(52,152,219,0.2);color:#3498db}
</style>
</head>
<body>
<div class="c">
  <div class="logo">🏘️</div>
  <h1>Balance Sheet</h1>
  
  <div class="box balance">
    <div class="amount">${absNet} KAS</div>
    <div class="direction">${direction}</div>
  </div>
  
  <div class="parties">
    <div class="party">
      <div class="label">Party A</div>
      <div class="value">${sheet.partyA.alias || sheet.partyA.address.slice(0,12)+'...'}</div>
      <div class="sig ${sheet.signatures.partyA ? 'ok' : 'wait'}">${sigA}</div>
    </div>
    <div class="party">
      <div class="label">Party B</div>
      <div class="value">${sheet.partyB.alias || sheet.partyB.address.slice(0,12)+'...'}</div>
      <div class="sig ${sheet.signatures.partyB ? 'ok' : 'wait'}">${sigB}</div>
    </div>
  </div>
  
  <div id="status"></div>
  
  <a href="${deepLink}" class="btn" id="signBtn">Open KasVillage to Sign</a>
  <button class="btn sec" onclick="manualSign()">Sign Manually</button>
  
  <div class="note">
    🔒 <strong>Direct P2P</strong><br>
    This page is served directly from the other person's phone. 
    No servers are involved. Your signature stays between you.
  </div>
</div>

<script>
const SHEET_ID = "${sheet.id}";
const API_BASE = window.location.origin;

let pollInterval = setInterval(async () => {
  try {
    const r = await fetch(API_BASE + '/api/sheet/' + SHEET_ID);
    if (r.ok) {
      const data = await r.json();
      if (data.signatures?.partyA && data.signatures?.partyB) {
        showStatus('Both parties signed!', 'ok');
        clearInterval(pollInterval);
      }
    }
  } catch(e) {}
}, 3000);

function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'show ' + type;
}

async function manualSign() {
  const pubkey = prompt('Your public key (64 hex chars):');
  if (!pubkey || !/^[0-9a-fA-F]{64}$/.test(pubkey)) { showStatus('Invalid pubkey format', 'err'); return; }
  
  const signature = prompt('Your signature (128 hex chars):');
  if (!signature || !/^[0-9a-fA-F]{128}$/.test(signature)) { showStatus('Invalid signature format', 'err'); return; }
  
  showStatus('Submitting...', 'info');
  
  try {
    const r = await fetch(API_BASE + '/api/sheet/' + SHEET_ID + '/sign', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({pubkey, signature, timestamp: Date.now()})
    });
    
    if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Failed'); }
    
    showStatus('✓ Signature submitted!', 'ok');
    document.getElementById('signBtn').textContent = 'Signed!';
    document.getElementById('signBtn').style.pointerEvents = 'none';
  } catch(e) {
    showStatus('Error: ' + e.message, 'err');
  }
}

const params = new URLSearchParams(window.location.search);
if (params.get('signed') === 'true') showStatus('✓ Signed via KasVillage app!', 'ok');
</script>
</body></html>`;
  }
}

export default LocalP2PServer;
