# G3TZKP Domain Deployment - Namecheap DNS Configuration

## 🌐 Domain: g3tzkp.com

### Step 1: Login to Namecheap
1. Go to: https://www.namecheap.com/myaccount/login
2. Enter your credentials
3. Click "Manage" next to g3tzkp.com

### Step 2: Access Advanced DNS Settings
1. Click on the domain "g3tzkp.com"
2. Go to the "Advanced DNS" tab
3. You should see existing records

### Step 3: Add/Update DNS Records

#### Record 1: Main App (CNAME)
```
Type:  CNAME Record
Host:  app
Value: cloudflare-ipfs.com
TTL:   5 min
```

**Action:**
- If "app" record exists: Delete it first
- Click "Add New Record"
- Select Type: CNAME
- Enter Host: `app`
- Enter Value: `cloudflare-ipfs.com`
- Set TTL: 5 min
- Save

#### Record 2: IPFS DNSLink (TXT)
```
Type:  TXT Record
Host:  _dnslink.app
Value: dnslink=/ipfs/[YOUR_CID]
TTL:   5 min
```

**Action:**
- Click "Add New Record"
- Select Type: TXT
- Enter Host: `_dnslink.app`
- Enter Value: `dnslink=/ipfs/Qm...` (replace with actual CID from deployment)
- Set TTL: 5 min
- Save

#### Record 3: Root Domain (Optional)
```
Type:  CNAME Record
Host:  @
Value: app.g3tzkp.com
TTL:   5 min
```

**Action:**
- Click "Add New Record"
- Select Type: CNAME
- Enter Host: `@`
- Enter Value: `app.g3tzkp.com`
- Set TTL: 5 min
- Save

### Step 4: Wait for Propagation
- DNS changes take 5-15 minutes to propagate
- Check propagation: https://www.whatsmydns.net/?d=g3tzkp.com

### Step 5: Verify Deployment

**Test access:**
```bash
# Direct IPFS (should work immediately)
curl https://[CID].ipfs.dweb.link

# Via Cloudflare IPFS (after DNS propagates)
curl https://app.g3tzkp.com

# Check DNS
nslookup app.g3tzkp.com
dig app.g3tzkp.com
```

## 📱 Access URLs

| URL | Status | Use Case |
|-----|--------|----------|
| `https://app.g3tzkp.com` | After DNS propagates | Primary mobile/web access |
| `https://[CID].ipfs.dweb.link` | Immediate | Direct IPFS fallback |
| `ipfs://[CID]` | Direct IPFS | Native IPFS clients |

## 🆘 Troubleshooting

### DNS Not Resolving
1. Verify TTL is set to 5 minutes (not 3600)
2. Clear browser cache: `Ctrl+Shift+Delete`
3. Check propagation: https://www.whatsmydns.net/
4. Wait 15 minutes, try again

### IPFS CID Not Loading
1. Verify CID is correct
2. Test via `[CID].ipfs.dweb.link` first
3. Ensure Cloudflare IPFS gateway is responsive
4. Use alternative gateway: `https://ipfs.io/ipfs/[CID]`

### Can't Access Domain
1. Check Namecheap shows correct records
2. Verify @ record points to app.g3tzkp.com
3. Try different browser/device
4. Clear DNS cache:
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemctl restart systemd-resolved`

## 🔄 Updating DNS with New CID

1. Get new CID from deployment
2. Go to Namecheap → Advanced DNS
3. Find TXT record `_dnslink.app`
4. Edit the Value: `dnslink=/ipfs/[NEW_CID]`
5. Save and wait 5-10 minutes

## 📝 API Alternative (If Supported)

```bash
curl -X POST 'https://api.namecheap.com/xml.response' \
  -d 'ApiUser=[USERNAME]&ApiKey=[API_KEY]&UserName=[USERNAME]' \
  -d 'Command=namecheap.domains.dns.setHosts' \
  -d 'SLD=g3tzkp&TLD=com' \
  -d 'HostName1=app&RecordType1=CNAME&Address1=cloudflare-ipfs.com&TTL1=300' \
  -d 'HostName2=_dnslink.app&RecordType2=TXT&Address2=dnslink=/ipfs/[CID]&TTL2=300'
```

**Note:** Requires API enabled on Namecheap account

## ✅ Deployment Checklist

- [ ] DNS records created in Namecheap
- [ ] TTL set to 5 minutes
- [ ] CID updated in TXT record
- [ ] DNS propagated (verify on whatsmydns.net)
- [ ] Direct IPFS link works
- [ ] app.g3tzkp.com is accessible
- [ ] Users can access from mobile
- [ ] Message sending works end-to-end
