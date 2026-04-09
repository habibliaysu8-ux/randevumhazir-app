BeautyHub Connected v2 + Admin

Müşteri sitesi: http://localhost:8000/
Partner paneli: http://localhost:8000/partner
Admin paneli: http://localhost:8000/admin

Demo müşteri
Telefon: 05001234567
Şifre: 123456

Demo partner
Telefon: 05550000000
Şifre: 123456

Demo admin
Email: admin@beautyhub.local
Şifre: 123456

Mac:
cd ~/Desktop/beautyhub_connected_v2_admin
python3 server.py

Windows:
cd Desktop\beautyhub_connected_v2_admin
python server.py

Bağlantı mantığı:
- Partner kaydı admin paneline beklemede düşer
- Admin onay verirse partner müşteri tarafında görünür
- Partner planı aktifse müşteri listelerinde kalır
- Müşteri randevu alınca partner paneline düşer
- Admin tüm randevuları ve ödemeleri görür
