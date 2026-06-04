#!/bin/bash
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
URL="exp://$IP:8081"
echo "📱 $URL"
python3 -c "
import qrcode, sys
img = qrcode.make('$URL')
path = '/tmp/expo_qr.png'
img.save(path)
print('QR saved:', path)
"
open /tmp/expo_qr.png
