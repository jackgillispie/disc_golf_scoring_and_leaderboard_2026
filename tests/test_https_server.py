import os
import ssl
from http.server import BaseHTTPRequestHandler, HTTPServer

certfilepath = os.path.join(
    os.path.abspath("C:/Users/jackg/Desktop/disc_golf_2026/tests"), "cert.crt"
)
keyfilepath = os.path.join(
    os.path.abspath("C:/Users/jackg/Desktop/disc_golf_2026/tests"), "key.pem"
)


print(certfilepath, keyfilepath)

httpd = HTTPServer(("192.168.12.105", 4444), BaseHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(
    httpd.socket, certfile=certfilepath, keyfile=keyfilepath, server_side=True
)

print("Hosting server on port 4444")
httpd.serve_forever()
