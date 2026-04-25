# Supabase gerçek kayıt / kalıcı veri sürümü

Bu sürümde müşteri, partner, salon, hizmet, saat, randevu ve şifre yenileme verileri Render dosya sistemi yerine Supabase PostgreSQL içinde saklanır.

## Render Environment içine ekle

Aşağıdaki değişkenlerden en önemlisi `DATABASE_URL`:

```env
DATABASE_URL=Supabase Connection String / Transaction pooler URL
PUBLIC_BASE_URL=https://randevumhazir-app.onrender.com
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=seninmailin@gmail.com
MAIL_PASS=Gmail App Password
MAIL_FROM=Randevumhazır <seninmailin@gmail.com>
```

## Supabase tarafında ekstra tablo açmana gerek yok

Uygulama ilk açıldığında Supabase içinde otomatik olarak şu tabloyu oluşturur:

```sql
randevumhazir_app_state
```

Bu tablonun içinde tüm uygulama verileri JSON olarak kalıcı saklanır. Böylece yeni ZIP/deploy yaptığında kayıtlar silinmez.

## Test sırası

1. GitHub’a yükle.
2. Render deploy bitsin.
3. Yeni müşteri kaydı yap.
4. Çıkış yapıp aynı maille giriş yap.
5. Şifremi unuttum mailini dene.
6. Yeni ZIP/deploy sonrası aynı hesapla tekrar giriş yapmayı dene.

Kayıtlar silinmiyorsa Supabase bağlantısı doğru çalışıyor demektir.
