# G3TZKP Messenger - Complete Deployment Guide

## 🚀 URGENT: Users in London Waiting!

This guide covers the complete deployment of G3TZKP Messenger to production.

---

## **PHASE 1: Pre-Deployment Verification**

### 1.1 Run Analysis
```bash
bash analyze-codebase.sh
```

**Expected Output:**
- ✅ Project structure: OK
- ✅ Crypto services: Implemented
- ✅ Messaging services: Implemented
- ✅ P2P services: Implemented
- ✅ Build tools: Configured

### 1.2 Run Tests
```bash
bash test-urgent.sh
```

**Expected Output:**
- ✅ BUILD SUCCESS
- ✅ TYPECHECK PASSED
- ✅ PWA Manifest exists
- ✅ Messaging services found
- ✅ Crypto implementation found

---

## **PHASE 2: Build Application**

### 2.1 Install Dependencies
```bash
cd "g3tzkp-messenger UI"
npm install
```

### 2.2 Build for Production
```bash
npm run build
```

**Expected Output:**
```
✓ 500+ modules bundled
✓ dist/ directory created
✓ manifest.json generated
```

### 2.3 Test Locally
```bash
npm run preview
```

**Access:** http://localhost:4173

**Test:**
1. Can you see the messenger interface?
2. Can you enter a message?
3. Does the UI respond?

---

## **PHASE 3: IPFS Deployment**

### 3.1 Install IPFS Deploy
```bash
npm install -g ipfs-deploy
# or
npx ipfs-deploy --version
```

### 3.2 Deploy to IPFS (Choose One)

#### Option A: Web3.Storage (Free, Recommended)
```bash
cd "g3tzkp-messenger UI"
npx ipfs-deploy ./dist -p web3storage --json | jq '.cid'
```

**Save the CID** - You'll need it for DNS!

#### Option B: Pinata (Free Tier)
```bash
# First, set environment variables
export PINATA_API_KEY="your-api-key"
export PINATA_SECRET_KEY="your-secret-key"

npx ipfs-deploy ./dist -p pinata --json | jq '.cid'
```

#### Option C: Infura
```bash
export INFURA_PROJECT_ID="your-project-id"
export INFURA_PROJECT_SECRET="your-secret"

npx ipfs-deploy ./dist -p infura --json | jq '.cid'
```

### 3.3 Verify IPFS Upload
```bash
# Replace [CID] with your actual CID
curl -s https://[CID].ipfs.dweb.link/index.html | head -20
```

**Expected:** HTML content of your app

---

## **PHASE 4: Configure Namecheap DNS**

### 4.1 Follow DNS Setup Guide
See: `NAMECHEAP_DNS_SETUP.md`

**Quick Summary:**
1. Login to Namecheap
2. Go to g3tzkp.com → Advanced DNS
3. Add CNAME: `app` → `cloudflare-ipfs.com`
4. Add TXT: `_dnslink.app` → `dnslink=/ipfs/[YOUR_CID]`
5. Wait 5-10 minutes for propagation

### 4.2 Verify DNS Propagation
```bash
# Check DNS
nslookup app.g3tzkp.com

# Check propagation status
# https://www.whatsmydns.net/?d=g3tzkp.com
```

**Expected:** Points to Cloudflare IPFS gateway

---

## **PHASE 5: Verify Deployment**

### 5.1 Test Direct IPFS Access
```bash
curl -s https://[CID].ipfs.dweb.link | grep -c "manifest"
```

**Expected:** Output ≥ 1 (HTML file found)

### 5.2 Test Domain Access
```bash
# After DNS propagates (5-10 minutes)
curl -s https://app.g3tzkp.com | grep -c "G3TZKP\|manifest"
```

**Expected:** Output ≥ 1

### 5.3 Test in Browser
- Chrome: https://app.g3tzkp.com
- Firefox: https://app.g3tzkp.com
- Safari: https://app.g3tzkp.com

**Expected:**
- ✅ App loads
- ✅ UI is interactive
- ✅ No console errors
- ✅ Connection status shows

---

## **PHASE 6: Test Message Sending**

### 6.1 Mobile Test (iPhone/Android)
1. Open https://app.g3tzkp.com on mobile
2. Tap "Add to Home Screen" (iOS) or "Install" (Android)
3. Launch app from home screen
4. Enter test peer ID
5. Send test message
6. Check console (F12) for "✅ Message sent"

### 6.2 Desktop Test
1. Open https://app.g3tzkp.com in desktop browser
2. Open DevTools (F12)
3. Go to Console tab
4. Send test message
5. Watch for "✅ EMERGENCY MESSAGE SENT" or "Message queued"

### 6.3 Multi-Device Test
1. Open app on 2+ devices
2. Share peer IDs between devices
3. Send message from Device A to Device B
4. Verify delivery

---

## **PHASE 7: Monitoring & Support**

### 7.1 Monitor Console Errors
```javascript
// Check for errors
window.addEventListener('error', (e) => {
  console.error('ERROR:', e.message);
});
```

### 7.2 Check Connection Status
```javascript
// In browser console
mobileMessagingService.isReady() // true/false
emergencyMessagingService.isReady() // true/false
emergencyMessagingService.getQueueSize() // number of queued messages
```

### 7.3 View Logs
1. Open DevTools (F12)
2. Go to Console tab
3. Look for:
   - ✅ EMERGENCY MESSAGE SENT
   - 📦 Message queued
   - ⏳ Offline detection
   - 🔐 Crypto operations

---

## **TROUBLESHOOTING**

### Issue: App Won't Load
**Solution:**
1. Check DNS: `nslookup app.g3tzkp.com`
2. Try direct IPFS: `https://[CID].ipfs.dweb.link`
3. Clear browser cache
4. Try different browser

### Issue: Messages Not Sending
**Solution:**
1. Check connection status (should be ✅)
2. Open DevTools → Console
3. Look for error messages
4. Check Firebase/Relay connection
5. Verify peer ID is correct

### Issue: Slow Response
**Solution:**
1. Check network (DevTools → Network)
2. Reduce message size
3. Try different relay
4. Check ISP/WiFi connection

### Issue: DNS Not Propagating
**Solution:**
1. Verify records in Namecheap
2. Check TTL is 5 minutes
3. Wait 15 minutes
4. Use different DNS: `8.8.8.8`, `1.1.1.1`
5. Clear DNS cache:
   ```bash
   # Windows
   ipconfig /flushdns
   
   # macOS
   sudo dscacheutil -flushcache
   
   # Linux
   sudo systemctl restart systemd-resolved
   ```

---

## **PRODUCTION CHECKLIST**

- [ ] Build completes without errors
- [ ] Tests pass (bash test-urgent.sh)
- [ ] IPFS upload successful (CID obtained)
- [ ] DNS records created in Namecheap
- [ ] DNS propagated (verified via whatsmydns.net)
- [ ] Direct IPFS link works
- [ ] app.g3tzkp.com loads in browser
- [ ] App loads on mobile
- [ ] Message sending works
- [ ] Messages persist in queue
- [ ] Connection status updates
- [ ] Console shows no errors
- [ ] Users can access from London

---

## **DEPLOYMENT SUCCESS CRITERIA**

✅ **Users can:**
- Load app at https://app.g3tzkp.com
- See connection status
- Send messages to other peers
- Receive messages from other peers
- View message queue status
- Send/receive while offline
- See messages deliver when online

✅ **App provides:**
- Real-time connection status
- Message encryption (X3DH + Double Ratchet)
- Multi-transport routing (Emergency, Mobile, WebRTC)
- Offline message queuing
- Automatic retry
- PWA functionality

---

## **SUPPORT**

**If deployment fails:**
1. Run `bash analyze-codebase.sh` - Get detailed audit
2. Run `bash test-urgent.sh` - Check components
3. Check console logs - Look for specific errors
4. Review NAMECHEAP_DNS_SETUP.md - Verify DNS config
5. Test each phase individually

**Quick Help:**
- Build issue? → Check Node.js version: `node --version`
- DNS issue? → Wait 15 minutes, then `nslookup app.g3tzkp.com`
- Message issue? → Open DevTools (F12) → Console
- IPFS issue? → Try direct gateway: `https://ipfs.io/ipfs/[CID]`

---

## **DONE! 🎉**

Your G3TZKP Messenger is now LIVE at **https://app.g3tzkp.com**

Share with users in London!
