import json
import os
import secrets
import sqlite3
from datetime import date, datetime, timedelta
from hashlib import sha256
import base64
from http import cookies
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / 'static'
DB_PATH = BASE_DIR / 'beautyhub_connected.db'
HOST = '0.0.0.0'
PORT = int(os.getenv('PORT', '8000'))
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', '').strip()
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '').strip()

CUSTOMER_SESSIONS = {}
PARTNER_SESSIONS = {}
ADMIN_SESSIONS = {}

CITY_DISTRICTS = {
    'İstanbul': ['Adalar','Arnavutköy','Ataşehir','Avcılar','Bağcılar','Bahçelievler','Bakırköy','Başakşehir','Bayrampaşa','Beşiktaş','Beykoz','Beylikdüzü','Beyoğlu','Büyükçekmece','Çatalca','Çekmeköy','Esenler','Esenyurt','Eyüpsultan','Fatih','Gaziosmanpaşa','Güngören','Kadıköy','Kağıthane','Kartal','Küçükçekmece','Maltepe','Pendik','Sancaktepe','Sarıyer','Silivri','Sultanbeyli','Sultangazi','Şile','Şişli','Tuzla','Ümraniye','Üsküdar','Zeytinburnu'],
    'Ankara': ['Akyurt','Altındağ','Ayaş','Bala','Beypazarı','Çamlıdere','Çankaya','Çubuk','Elmadağ','Etimesgut','Evren','Gölbaşı','Güdül','Haymana','Kahramankazan','Kalecik','Keçiören','Kızılcahamam','Mamak','Nallıhan','Polatlı','Pursaklar','Sincan','Şereflikoçhisar','Yenimahalle'],
    'İzmir': ['Aliağa','Balçova','Bayındır','Bayraklı','Bergama','Beydağ','Bornova','Buca','Çeşme','Çiğli','Dikili','Foça','Gaziemir','Güzelbahçe','Karabağlar','Karaburun','Karşıyaka','Kemalpaşa','Kınık','Kiraz','Konak','Menderes','Menemen','Narlıdere','Ödemiş','Seferihisar','Selçuk','Tire','Torbalı','Urla']
}
TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
DEFAULT_SERVICES = {
    'Tırnak': ['Protez Tırnak', 'Jel Tırnak', 'Kalıcı Oje', 'Nail Art', 'Manikür', 'Pedikür'],
    'Saç': ['Kesim', 'Fön', 'Boya', 'Ombre', 'Keratin Bakım', 'Topuz'],
    'Makyaj': ['Günlük Makyaj', 'Gece Makyajı', 'Gelin Makyajı'],
    'Kaş & Kirpik': ['Kaş Tasarımı', 'Lash Lift', 'İpek Kirpik', 'Kaş Laminasyonu'],
    'Cilt Bakımı': ['Klasik Cilt Bakımı', 'Hydrafacial', 'Leke Bakımı'],
    'Lazer & Epilasyon': ['Tüm Vücut Lazer', 'Bölgesel Lazer', 'Bakım Paketi'],
}
PORTFOLIO_BY_CATEGORY = {
    'Tırnak': ['French', 'Chrome', 'Minimal Desen'],
    'Saç': ['Katlı Kesim', 'Soft Ombre', 'Işıltılı Fön'],
    'Makyaj': ['Soft Glam', 'Gece Işıltısı', 'Bride Look'],
    'Kaş & Kirpik': ['Doğal Lift', 'Dolgun Kirpik', 'Kaş Laminasyon'],
    'Cilt Bakımı': ['Glow Cilt', 'Nem Terapisi', 'Arındırıcı Bakım'],
    'Lazer & Epilasyon': ['Bölgesel Paket', 'Tam Vücut', 'Bakım Seansı'],
}



def portfolio_palette(seed: str):
    palettes = [
        ('#ffe3f1', '#f472b6', '#be185d'),
        ('#e0f2fe', '#38bdf8', '#0f766e'),
        ('#f3e8ff', '#a78bfa', '#6d28d9'),
        ('#dcfce7', '#4ade80', '#166534'),
        ('#fde68a', '#f59e0b', '#92400e'),
        ('#fce7f3', '#ec4899', '#9d174d'),
    ]
    total = sum(ord(ch) for ch in (seed or 'portfolio'))
    return palettes[total % len(palettes)]


def default_portfolio_image(title: str, category: str, index: int = 0) -> str:
    bg1, bg2, accent = portfolio_palette(f'{category}-{title}-{index}')
    emoji_map = {
        'Tırnak': '💅',
        'Saç': '💇',
        'Makyaj': '💄',
        'Kaş & Kirpik': '👁️',
        'Cilt Bakımı': '🧴',
        'Lazer & Epilasyon': '✨',
    }
    emoji = emoji_map.get(normalize_category(category), '✨')
    safe_title = (title or 'El işi').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')[:20]
    safe_category = (normalize_category(category) or category or 'BeautyHub').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')[:18]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="760" viewBox="0 0 640 760">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="{bg1}"/>
          <stop offset="100%" stop-color="{bg2}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="54" fill="url(#g)"/>
      <rect x="38" y="38" width="564" height="684" rx="46" fill="rgba(255,255,255,0.55)"/>
      <circle cx="320" cy="236" r="108" fill="rgba(255,255,255,0.88)"/>
      <text x="320" y="260" text-anchor="middle" font-size="90">{emoji}</text>
      <rect x="126" y="468" width="388" height="92" rx="32" fill="rgba(255,255,255,0.92)"/>
      <text x="320" y="522" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="{accent}">{safe_title}</text>
      <text x="320" y="590" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#4c3c63">{safe_category}</text>
      <text x="320" y="632" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#6b5b83">Partner el işi görseli</text>
    </svg>'''
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode('ascii')


def normalize_data_url_image(value: str) -> str:
    raw = (value or '').strip()
    if raw.startswith('data:image/'):
        return raw
    return ''

PARTNER_CATEGORY_TO_CUSTOMER = {
    'tırnak': 'Tırnak',
    'saç': 'Saç',
    'makyaj': 'Makyaj',
    'kaşkirpik': 'Kaş & Kirpik',
    'cilt': 'Cilt Bakımı',
    'epilasyon': 'Lazer & Epilasyon',
}
CUSTOMER_CATEGORY_TO_PARTNER = {v: k for k, v in PARTNER_CATEGORY_TO_CUSTOMER.items()}
DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
WEEKDAY_TO_TR = {0: 'Pazartesi', 1: 'Salı', 2: 'Çarşamba', 3: 'Perşembe', 4: 'Cuma', 5: 'Cumartesi', 6: 'Pazar'}


def normalize_category(value: str) -> str:
    value = (value or '').strip()
    if not value:
        return ''
    if value in PARTNER_CATEGORY_TO_CUSTOMER:
        return PARTNER_CATEGORY_TO_CUSTOMER[value]
    if value in CUSTOMER_CATEGORY_TO_PARTNER:
        return value
    lowered = value.casefold()
    for partner_key, customer_value in PARTNER_CATEGORY_TO_CUSTOMER.items():
        if lowered == partner_key.casefold() or lowered == customer_value.casefold():
            return customer_value
    return value


def default_slots_for_day(day_name: str, is_open: int = 1):
    if not is_open:
        return []
    if day_name == 'Cumartesi':
        return ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    return ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']


def day_name_from_iso(date_str: str) -> str:
    try:
        return WEEKDAY_TO_TR[datetime.strptime(date_str, '%Y-%m-%d').weekday()]
    except Exception:
        return ''


def parse_slot_times(raw):
    if isinstance(raw, list):
        return [item for item in raw if item in TIME_SLOTS]
    try:
        items = json.loads(raw or '[]')
        if isinstance(items, list):
            return [item for item in items if item in TIME_SLOTS]
    except Exception:
        pass
    return []


def effective_slots_for_date(conn, partner_user_id: int, date_str: str):
    requested_day = day_name_from_iso(date_str)
    if not requested_day:
        return []
    override_row = conn.execute(
        'SELECT slot_times, is_open FROM partner_date_slots WHERE partner_user_id=? AND slot_date=?',
        (partner_user_id, date_str)
    ).fetchone()
    if override_row is not None:
        if not override_row['is_open']:
            return []
        return parse_slot_times(override_row['slot_times'])
    hour_row = conn.execute(
        'SELECT slot_times, is_open FROM partner_hours WHERE partner_user_id=? AND day_name=?',
        (partner_user_id, requested_day)
    ).fetchone()
    if not hour_row or not hour_row['is_open']:
        return []
    return parse_slot_times(hour_row['slot_times'])


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    return sha256(password.encode('utf-8')).hexdigest()


def parse_json_body(handler):
    length = int(handler.headers.get('Content-Length', '0'))
    raw = handler.rfile.read(length) if length else b'{}'
    return json.loads(raw.decode('utf-8') or '{}')


def load_cookie(handler):
    raw = handler.headers.get('Cookie')
    jar = cookies.SimpleCookie()
    if raw:
        jar.load(raw)
    return jar


def get_customer(handler):
    jar = load_cookie(handler)
    token = jar.get('customer_session')
    if not token or token.value not in CUSTOMER_SESSIONS:
        return None
    uid = CUSTOMER_SESSIONS[token.value]
    conn = db_conn()
    row = conn.execute('SELECT id, phone FROM customer_users WHERE id=?', (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_partner(handler):
    jar = load_cookie(handler)
    token = jar.get('partner_session')
    if not token or token.value not in PARTNER_SESSIONS:
        return None
    uid = PARTNER_SESSIONS[token.value]
    conn = db_conn()
    row = conn.execute('SELECT id, business_name, phone FROM partner_users WHERE id=?', (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_admin(handler):
    jar = load_cookie(handler)
    token = jar.get('admin_session')
    if not token or token.value not in ADMIN_SESSIONS:
        return None
    uid = ADMIN_SESSIONS[token.value]
    conn = db_conn()
    row = conn.execute('SELECT id, email, full_name FROM admin_users WHERE id=?', (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def make_cookie(name, value, max_age=None):
    parts = [f'{name}={value}', 'Path=/', 'HttpOnly', 'SameSite=Lax']
    if max_age is not None:
        parts.append(f'Max-Age={max_age}')
    return '; '.join(parts)


def json_response(handler, payload, status=200, cookies_to_set=None, cookies_to_clear=None):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    for ck in cookies_to_set or []:
        handler.send_header('Set-Cookie', ck)
    for ck in cookies_to_clear or []:
        handler.send_header('Set-Cookie', ck)
    handler.end_headers()
    handler.wfile.write(body)


def send_file(handler, path: Path, ctype='text/html; charset=utf-8'):
    if not path.exists():
        handler.send_error(404)
        return
    data = path.read_bytes()
    handler.send_response(200)
    handler.send_header('Content-Type', ctype)
    handler.send_header('Content-Length', str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def ensure_column(conn, table: str, column: str, ddl: str):
    cols = [r['name'] for r in conn.execute(f'PRAGMA table_info({table})').fetchall()]
    if column not in cols:
        conn.execute(f'ALTER TABLE {table} ADD COLUMN {ddl}')
        conn.commit()


def init_db():
    conn = db_conn()
    cur = conn.cursor()
    cur.executescript('''
        CREATE TABLE IF NOT EXISTS customer_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS partner_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS partner_profiles (
            partner_user_id INTEGER PRIMARY KEY,
            business_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            city TEXT NOT NULL,
            district TEXT NOT NULL,
            address TEXT NOT NULL,
            description TEXT NOT NULL,
            rating REAL NOT NULL DEFAULT 4.8,
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_portfolio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            image_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_hours (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_user_id INTEGER NOT NULL,
            day_name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            is_open INTEGER NOT NULL DEFAULT 1,
            UNIQUE(partner_user_id, day_name),
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_date_slots (
            partner_user_id INTEGER NOT NULL,
            slot_date TEXT NOT NULL,
            slot_times TEXT NOT NULL DEFAULT '[]',
            is_open INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (partner_user_id, slot_date),
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_settings (
            partner_user_id INTEGER PRIMARY KEY,
            email_notifications INTEGER NOT NULL DEFAULT 1,
            message_notifications INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_plan (
            partner_user_id INTEGER PRIMARY KEY,
            active_plan TEXT NOT NULL DEFAULT 'none',
            daily_price INTEGER NOT NULL DEFAULT 150,
            weekly_price INTEGER NOT NULL DEFAULT 910,
            days_left INTEGER NOT NULL DEFAULT 0,
            ends_at TEXT NOT NULL DEFAULT 'Plan seçilmedi',
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_user_id INTEGER NOT NULL,
            plan_type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            method TEXT NOT NULL,
            card_last4 TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'paid',
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS partner_admin (
            partner_user_id INTEGER PRIMARY KEY,
            approval_status TEXT NOT NULL DEFAULT 'pending',
            visible_in_market INTEGER NOT NULL DEFAULT 1,
            note TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_user_id INTEGER NOT NULL,
            partner_user_id INTEGER NOT NULL,
            service_name TEXT NOT NULL,
            category TEXT NOT NULL,
            district TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            time_label TEXT NOT NULL,
            note TEXT DEFAULT '',
            price INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            FOREIGN KEY(customer_user_id) REFERENCES customer_users(id),
            FOREIGN KEY(partner_user_id) REFERENCES partner_users(id)
        );
    ''')

    ensure_column(conn, 'partner_profiles', 'rating', 'rating REAL NOT NULL DEFAULT 4.8')
    ensure_column(conn, 'partner_hours', 'slot_times', "slot_times TEXT NOT NULL DEFAULT '[]'")
    ensure_column(conn, 'partner_date_slots', 'slot_times', "slot_times TEXT NOT NULL DEFAULT '[]'")
    ensure_column(conn, 'partner_date_slots', 'is_open', 'is_open INTEGER NOT NULL DEFAULT 1')
    ensure_column(conn, 'partner_date_slots', 'updated_at', "updated_at TEXT NOT NULL DEFAULT ''")
    if ADMIN_EMAIL and ADMIN_PASSWORD:
        cur.execute('SELECT id FROM admin_users WHERE email=?', (ADMIN_EMAIL,))
        if not cur.fetchone():
            cur.execute('INSERT INTO admin_users (email, password_hash, full_name, created_at) VALUES (?,?,?,?)', (
                ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), 'Site Yöneticisi', datetime.now().strftime('%d.%m.%Y %H:%M')
            ))

    portfolio_missing = cur.execute('SELECT id FROM partner_users WHERE id NOT IN (SELECT partner_user_id FROM partner_portfolio)').fetchall()
    for row in portfolio_missing:
        pid = row['id']
        svc_rows = cur.execute('SELECT name, category FROM partner_services WHERE partner_user_id=? ORDER BY id DESC LIMIT 3', (pid,)).fetchall()
        for s_idx, svc in enumerate(svc_rows):
            cat = normalize_category(svc['category'])
            cur.execute('INSERT INTO partner_portfolio (partner_user_id, category, title, image_data, created_at) VALUES (?,?,?,?,?)', (pid, cat, svc['name'], default_portfolio_image(svc['name'], cat, s_idx), datetime.now().strftime('%d.%m.%Y %H:%M')))

    conn.commit()
    conn.close()


def get_service_catalog():
    catalog = {k: list(v) for k, v in DEFAULT_SERVICES.items()}
    conn = db_conn()
    rows = conn.execute('SELECT DISTINCT category, name FROM partner_services ORDER BY category, name').fetchall()
    conn.close()
    for row in rows:
        category = normalize_category(row['category'])
        catalog.setdefault(category, [])
        if row['name'] not in catalog[category]:
            catalog[category].append(row['name'])
    return catalog


def format_status_for_customer(status):
    return {'pending':'Beklemede','approved':'Onaylandı','rejected':'Reddedildi','cancelled':'İptal Edildi'}.get(status, status)


def format_approval_status(status):
    return {'approved': 'Onaylı', 'pending': 'Bekliyor', 'rejected': 'Reddedildi'}.get(status, status)



def portfolio_for_partner(conn, partner_user_id, category):
    normalized_category = normalize_category(category)
    rows = conn.execute(
        'SELECT id, title, image_data, category FROM partner_portfolio WHERE partner_user_id=? AND category=? ORDER BY id DESC LIMIT 6',
        (partner_user_id, normalized_category)
    ).fetchall()
    if not rows:
        rows = conn.execute(
            'SELECT id, title, image_data, category FROM partner_portfolio WHERE partner_user_id=? ORDER BY id DESC LIMIT 6',
            (partner_user_id,)
        ).fetchall()
    items = [
        {
            'id': r['id'],
            'title': r['title'],
            'image_data': normalize_data_url_image(r['image_data']) or default_portfolio_image(r['title'], r['category'], i),
            'category': normalize_category(r['category']) or r['category'],
        }
        for i, r in enumerate(rows)
    ]
    if len(items) < 3:
        seeds = [r['name'] for r in conn.execute('SELECT name FROM partner_services WHERE partner_user_id=? AND category=? ORDER BY id DESC LIMIT 3', (partner_user_id, normalized_category)).fetchall()]
        if not seeds:
            seeds = PORTFOLIO_BY_CATEGORY.get(normalized_category, ['Özel İş', 'Yeni Uygulama', 'Popüler Model'])
        for extra in seeds:
            if not any(item['title'] == extra for item in items):
                items.append({
                    'id': None,
                    'title': extra,
                    'image_data': default_portfolio_image(extra, normalized_category, len(items)),
                    'category': normalized_category,
                })
            if len(items) == 3:
                break
    return items


def build_professional_items(category='', district='', service='', appointment_date='', time_label=''):
    conn = db_conn()
    normalized_category = normalize_category(category)
    query = """
        SELECT pu.id, pp.business_name as name, pp.district, pp.description, pp.rating,
               MIN(ps.price) as min_price, MAX(ps.price) as max_price
        FROM partner_users pu
        JOIN partner_profiles pp ON pp.partner_user_id = pu.id
        JOIN partner_plan pl ON pl.partner_user_id = pu.id
        JOIN partner_services ps ON ps.partner_user_id = pu.id
        JOIN partner_admin pa ON pa.partner_user_id = pu.id
        WHERE pl.active_plan != 'none' AND pa.approval_status='approved' AND pa.visible_in_market=1
    """
    params = []
    if normalized_category:
        query += ' AND ps.category = ?'
        params.append(normalized_category)
    if district:
        query += ' AND pp.district = ?'
        params.append(district)
    if service:
        query += ' AND ps.name = ?'
        params.append(service)
    query += ' GROUP BY pu.id, pp.business_name, pp.district, pp.description, pp.rating ORDER BY pp.rating DESC, pu.id DESC'
    rows = conn.execute(query, params).fetchall()
    requested_day = day_name_from_iso(appointment_date) if appointment_date else ''
    items = []
    for row in rows:
        cat_row = conn.execute('SELECT category FROM partner_services WHERE partner_user_id=? ORDER BY id LIMIT 1', (row['id'],)).fetchone()
        cat = normalized_category or (normalize_category(cat_row['category']) if cat_row else '')
        slots = []
        if requested_day:
            slots = effective_slots_for_date(conn, row['id'], appointment_date)
            if not slots:
                continue
            if time_label and time_label not in slots:
                continue
        services = [r['name'] for r in conn.execute('SELECT name FROM partner_services WHERE partner_user_id=? AND category=? ORDER BY id DESC LIMIT 3', (row['id'], cat)).fetchall()]
        items.append({
            'id': row['id'],
            'name': row['name'],
            'category': cat,
            'district': row['district'],
            'rating': row['rating'],
            'description': row['description'],
            'services': services,
            'portfolio': portfolio_for_partner(conn, row['id'], cat),
            'price_range': f"₺{int(row['min_price'])} - ₺{int(row['max_price'])}",
            'available_day': requested_day,
            'available_slots': slots,
        })
    conn.close()
    return items


def get_partner_bootstrap(pid):
    conn = db_conn()
    profile = dict(conn.execute('SELECT business_name, phone, city, district, address, description FROM partner_profiles WHERE partner_user_id=?', (pid,)).fetchone())
    services = [dict(r) for r in conn.execute('SELECT id, name, category, price, duration FROM partner_services WHERE partner_user_id=? ORDER BY id DESC', (pid,)).fetchall()]
    hours = [dict(r) for r in conn.execute("SELECT day_name,start_time,end_time,is_open,slot_times FROM partner_hours WHERE partner_user_id=? ORDER BY CASE day_name WHEN 'Pazartesi' THEN 1 WHEN 'Salı' THEN 2 WHEN 'Çarşamba' THEN 3 WHEN 'Perşembe' THEN 4 WHEN 'Cuma' THEN 5 WHEN 'Cumartesi' THEN 6 ELSE 7 END", (pid,)).fetchall()]
    appt_rows = conn.execute('SELECT a.*, cu.phone as customer_phone FROM appointments a JOIN customer_users cu ON cu.id = a.customer_user_id WHERE a.partner_user_id=? ORDER BY a.id ASC', (pid,)).fetchall()
    appointments = [{'id': r['id'], 'customer_name': r['customer_phone'], 'service_name': r['service_name'], 'date_label': r['appointment_date'], 'time_label': r['time_label'], 'price': r['price'], 'status': r['status']} for r in appt_rows]
    settings = dict(conn.execute('SELECT email_notifications, message_notifications FROM partner_settings WHERE partner_user_id=?', (pid,)).fetchone())
    plan = dict(conn.execute('SELECT active_plan,daily_price,weekly_price,days_left,ends_at FROM partner_plan WHERE partner_user_id=?', (pid,)).fetchone())
    payments = [dict(r) for r in conn.execute('SELECT plan_type, amount, method, card_last4, created_at, status FROM partner_payments WHERE partner_user_id=? ORDER BY id DESC', (pid,)).fetchall()]
    admin_info = dict(conn.execute('SELECT approval_status, visible_in_market, note, updated_at FROM partner_admin WHERE partner_user_id=?', (pid,)).fetchone())
    portfolio = [dict(r) for r in conn.execute('SELECT id, category, title, image_data, created_at FROM partner_portfolio WHERE partner_user_id=? ORDER BY id DESC', (pid,)).fetchall()]
    conn.close()
    return {'profile': profile, 'services': services, 'hours': hours, 'appointments': appointments, 'settings': settings, 'plan': plan, 'payments': payments, 'admin_info': admin_info, 'portfolio': portfolio}


def get_admin_bootstrap():
    conn = db_conn()
    summary = {
        'customers': conn.execute('SELECT COUNT(*) c FROM customer_users').fetchone()['c'],
        'partners_total': conn.execute('SELECT COUNT(*) c FROM partner_users').fetchone()['c'],
        'partners_approved': conn.execute("SELECT COUNT(*) c FROM partner_admin WHERE approval_status='approved'").fetchone()['c'],
        'partners_pending': conn.execute("SELECT COUNT(*) c FROM partner_admin WHERE approval_status='pending'").fetchone()['c'],
        'appointments_total': conn.execute('SELECT COUNT(*) c FROM appointments').fetchone()['c'],
        'payments_total': conn.execute('SELECT COALESCE(SUM(amount),0) s FROM partner_payments WHERE status="paid"').fetchone()['s'],
    }
    partners = [dict(r) for r in conn.execute('''
        SELECT pu.id, pu.business_name, pu.phone, pp.city, pp.district, pp.rating,
               pa.approval_status, pa.visible_in_market, pa.note,
               pl.active_plan, pl.days_left, pl.ends_at
        FROM partner_users pu
        JOIN partner_profiles pp ON pp.partner_user_id = pu.id
        JOIN partner_admin pa ON pa.partner_user_id = pu.id
        JOIN partner_plan pl ON pl.partner_user_id = pu.id
        ORDER BY CASE pa.approval_status WHEN 'pending' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, pu.id DESC
    ''').fetchall()]
    customers = [dict(r) for r in conn.execute('SELECT id, phone, created_at FROM customer_users ORDER BY id DESC').fetchall()]
    appointments = [dict(r) for r in conn.execute('''
        SELECT a.id, a.service_name, a.category, a.appointment_date, a.time_label, a.price, a.status,
               cu.phone AS customer_phone, pp.business_name AS partner_name
        FROM appointments a
        JOIN customer_users cu ON cu.id = a.customer_user_id
        JOIN partner_profiles pp ON pp.partner_user_id = a.partner_user_id
        ORDER BY a.id DESC
    ''').fetchall()]
    payments = [dict(r) for r in conn.execute('''
        SELECT pp.business_name, pay.plan_type, pay.amount, pay.method, pay.card_last4, pay.created_at, pay.status
        FROM partner_payments pay
        JOIN partner_profiles pp ON pp.partner_user_id = pay.partner_user_id
        ORDER BY pay.id DESC
    ''').fetchall()]
    conn.close()
    return {'summary': summary, 'partners': partners, 'customers': customers, 'appointments': appointments, 'payments': payments}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ('/', '/index.html'):
            return send_file(self, STATIC_DIR / 'index.html')
        if path == '/style.css':
            return send_file(self, STATIC_DIR / 'style.css', 'text/css; charset=utf-8')
        if path == '/app.js':
            return send_file(self, STATIC_DIR / 'app.js', 'application/javascript; charset=utf-8')
        if path == '/robots.txt':
            return send_file(self, STATIC_DIR / 'robots.txt', 'text/plain; charset=utf-8')
        if path == '/sitemap.xml':
            return send_file(self, STATIC_DIR / 'sitemap.xml', 'application/xml; charset=utf-8')
        if path == '/partner':
            return send_file(self, STATIC_DIR / 'partner' / 'index.html')
        if path == '/admin':
            return send_file(self, STATIC_DIR / 'admin' / 'index.html')

        if path == '/customer-api/config':
            return json_response(self, {'districts': CITY_DISTRICTS['İstanbul'], 'services': get_service_catalog(), 'time_slots': TIME_SLOTS})
        if path == '/customer-api/me':
            return json_response(self, {'user': get_customer(self)})
        if path == '/customer-api/professionals':
            qs = parse_qs(parsed.query)
            items = build_professional_items(qs.get('category',[''])[0], qs.get('district',[''])[0], qs.get('service',[''])[0], qs.get('date',[''])[0], qs.get('time',[''])[0])
            return json_response(self, {'items': items})

        if path == '/api/meta':
            catalog = get_service_catalog()
            service_map = {CUSTOMER_CATEGORY_TO_PARTNER.get(category, category.lower()): names for category, names in catalog.items()}
            return json_response(self, {'serviceMap': service_map, 'timeSlots': TIME_SLOTS, 'districts': CITY_DISTRICTS})
        if path == '/customer-api/appointments':
            customer = get_customer(self)
            if not customer:
                return json_response(self, {'error': 'Giriş gerekli.'}, 401)
            conn = db_conn()
            rows = conn.execute('''
                SELECT a.*, pp.business_name as professional_name, pp.district, pp.rating
                FROM appointments a
                JOIN partner_profiles pp ON pp.partner_user_id = a.partner_user_id
                WHERE a.customer_user_id=?
                ORDER BY a.id DESC
            ''', (customer['id'],)).fetchall()
            items = []
            for row in rows:
                services = [r['name'] for r in conn.execute('SELECT name FROM partner_services WHERE partner_user_id=? AND category=? ORDER BY id DESC LIMIT 3', (row['partner_user_id'], row['category'])).fetchall()]
                items.append({
                    'id': row['id'],
                    'professional_name': row['professional_name'],
                    'category': row['category'],
                    'district': row['district'],
                    'rating': row['rating'],
                    'price_range': f"₺{row['price']}",
                    'service': row['service_name'],
                    'appointment_date': row['appointment_date'],
                    'time_range': row['time_label'],
                    'status': format_status_for_customer(row['status']),
                    'portfolio': portfolio_for_partner(conn, row['partner_user_id'], row['category']),
                    'services': services,
                })
            conn.close()
            return json_response(self, {'items': items})

        if path == '/api/bootstrap':
            partner = get_partner(self)
            if not partner:
                return json_response(self, {'error': 'Partner girişi gerekli.'}, 401)
            return json_response(self, get_partner_bootstrap(partner['id']))
        if path == '/api/me':
            return json_response(self, {'user': get_partner(self)})
        if path == '/api/date-slots':
            partner = get_partner(self)
            if not partner:
                return json_response(self, {'error': 'Partner girişi gerekli.'}, 401)
            slot_date = parse_qs(parsed.query).get('date', [''])[0]
            if not slot_date:
                return json_response(self, {'error': 'Tarih gerekli.'}, 400)
            conn = db_conn()
            slots = effective_slots_for_date(conn, partner['id'], slot_date)
            conn.close()
            return json_response(self, {'slot_date': slot_date, 'day_name': day_name_from_iso(slot_date), 'slots': slots})

        if path == '/admin-api/me':
            return json_response(self, {'user': get_admin(self)})
        if path == '/admin-api/bootstrap':
            admin = get_admin(self)
            if not admin:
                return json_response(self, {'error': 'Admin girişi gerekli.'}, 401)
            return json_response(self, get_admin_bootstrap())

        self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        data = parse_json_body(self)

        if path == '/customer-api/login':
            phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit())
            password = data.get('password','').strip()
            conn = db_conn()
            row = conn.execute('SELECT id FROM customer_users WHERE phone=? AND password_hash=?', (phone, hash_password(password))).fetchone()
            conn.close()
            if not row:
                return json_response(self, {'error': 'Telefon veya şifre yanlış.'}, 401)
            token = secrets.token_hex(16)
            CUSTOMER_SESSIONS[token] = row['id']
            return json_response(self, {'ok': True, 'user': {'id': row['id'], 'phone': phone}}, cookies_to_set=[make_cookie('customer_session', token)])
        if path == '/customer-api/register':
            phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit())
            password = data.get('password','').strip()
            if len(phone) < 10 or len(password) < 6:
                return json_response(self, {'error': 'Telefon veya şifre eksik.'}, 400)
            conn = db_conn(); cur = conn.cursor()
            try:
                cur.execute('INSERT INTO customer_users (phone, password_hash, created_at) VALUES (?,?,?)', (phone, hash_password(password), datetime.now().strftime('%d.%m.%Y %H:%M')))
                conn.commit(); uid = cur.lastrowid
            except sqlite3.IntegrityError:
                conn.close(); return json_response(self, {'error': 'Bu numara ile kayıt var.'}, 400)
            conn.close()
            token = secrets.token_hex(16)
            CUSTOMER_SESSIONS[token] = uid
            return json_response(self, {'ok': True, 'user': {'id': uid, 'phone': phone}}, cookies_to_set=[make_cookie('customer_session', token)])
        if path == '/customer-api/forgot-password':
            phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit())
            new_password = data.get('new_password','').strip()
            if len(phone) < 10 or len(new_password) < 6:
                return json_response(self, {'error': 'Eksik bilgi.'}, 400)
            conn = db_conn(); cur = conn.cursor(); cur.execute('UPDATE customer_users SET password_hash=? WHERE phone=?', (hash_password(new_password), phone)); conn.commit(); changed = cur.rowcount; conn.close()
            if not changed:
                return json_response(self, {'error': 'Bu numara bulunamadı.'}, 404)
            return json_response(self, {'ok': True})
        if path == '/customer-api/logout':
            token = load_cookie(self).get('customer_session')
            if token: CUSTOMER_SESSIONS.pop(token.value, None)
            return json_response(self, {'ok': True}, cookies_to_clear=[make_cookie('customer_session','',0)])
        if path == '/customer-api/appointments':
            customer = get_customer(self)
            if not customer:
                return json_response(self, {'error': 'Randevu için önce giriş yap.'}, 401)
            pid = int(data.get('professional_id') or 0)
            category = data.get('category','').strip(); service = data.get('service','').strip(); district = data.get('district','').strip()
            appointment_date = data.get('appointment_date','').strip(); time_label = data.get('time_range','').strip(); note = data.get('note','').strip()
            if not pid or not category or not service or not appointment_date or not time_label:
                return json_response(self, {'error': 'Randevu bilgileri eksik.'}, 400)
            conn = db_conn(); price_row = conn.execute('SELECT price FROM partner_services WHERE partner_user_id=? AND name=? ORDER BY id DESC LIMIT 1', (pid, service)).fetchone(); price = int(price_row['price']) if price_row else 0
            available_slots = effective_slots_for_date(conn, pid, appointment_date)
            if time_label not in available_slots:
                conn.close(); return json_response(self, {'error': 'Seçilen tarih/saat partner için açık değil.'}, 400)
            conflict = conn.execute("SELECT 1 FROM appointments WHERE partner_user_id=? AND appointment_date=? AND time_label=? AND status NOT IN ('cancelled','rejected')", (pid, appointment_date, time_label)).fetchone()
            if conflict:
                conn.close(); return json_response(self, {'error': 'Bu saat dolu. Başka saat seç.'}, 400)
            conn.execute('INSERT INTO appointments (customer_user_id, partner_user_id, service_name, category, district, appointment_date, time_label, note, price, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', (customer['id'], pid, service, category, district, appointment_date, time_label, note, price, 'pending', datetime.now().strftime('%d.%m.%Y %H:%M')))
            conn.commit(); conn.close()
            return json_response(self, {'ok': True, 'message': 'Randevu partner paneline düştü.'})

        if path == '/api/auth/login':
            phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit())
            password = data.get('password','').strip()
            conn = db_conn(); row = conn.execute('SELECT id,business_name,phone FROM partner_users WHERE phone=? AND password_hash=?', (phone, hash_password(password))).fetchone(); conn.close()
            if not row:
                return json_response(self, {'error': 'Numara veya şifre yanlış.'}, 401)
            token = secrets.token_hex(16); PARTNER_SESSIONS[token] = row['id']
            return json_response(self, {'ok': True, 'user': {'business_name': row['business_name'], 'phone': row['phone']}}, cookies_to_set=[make_cookie('partner_session', token)])
        if path == '/api/auth/register':
            business_name = data.get('business_name','').strip(); phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit()); password = data.get('password','').strip()
            if not business_name or len(phone) < 10 or len(password) < 4:
                return json_response(self, {'error': 'Kayıt bilgileri eksik.'}, 400)
            conn = db_conn(); cur = conn.cursor()
            try:
                cur.execute('INSERT INTO partner_users (business_name, phone, password_hash, created_at) VALUES (?,?,?,?)', (business_name, phone, hash_password(password), datetime.now().strftime('%d.%m.%Y %H:%M')))
                pid = cur.lastrowid
                cur.execute('INSERT INTO partner_profiles (partner_user_id,business_name,phone,city,district,address,description,rating) VALUES (?,?,?,?,?,?,?,?)', (pid, business_name, phone, 'İstanbul', 'Beşiktaş', '', '', 4.8))
                cur.execute('INSERT INTO partner_settings (partner_user_id,email_notifications,message_notifications) VALUES (?,?,?)', (pid,1,1))
                days_left = 6
                ends_at = (date.today() + timedelta(days=days_left)).strftime('%d %B')
                cur.execute('INSERT INTO partner_plan (partner_user_id,active_plan,daily_price,weekly_price,days_left,ends_at) VALUES (?,?,?,?,?,?)', (pid,'weekly',150,910,days_left,ends_at))
                cur.execute('INSERT INTO partner_admin (partner_user_id,approval_status,visible_in_market,note,updated_at) VALUES (?,?,?,?,?)', (pid,'approved',1,'Müşteri panelinde görünür.',datetime.now().strftime('%d.%m.%Y %H:%M')))
                for day_name, start, end, open_ in [('Pazartesi','10:00','19:00',1),('Salı','10:00','19:00',1),('Çarşamba','10:00','19:00',1),('Perşembe','10:00','19:00',1),('Cuma','10:00','19:00',1),('Cumartesi','11:00','18:00',1),('Pazar','10:00','19:00',0)]:
                    cur.execute('INSERT INTO partner_hours (partner_user_id,day_name,start_time,end_time,is_open,slot_times) VALUES (?,?,?,?,?,?)', (pid, day_name, start, end, open_, json.dumps(default_slots_for_day(day_name, open_), ensure_ascii=False)))
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close(); return json_response(self, {'error': 'Bu numara ile kayıt var.'}, 400)
            conn.close(); token = secrets.token_hex(16); PARTNER_SESSIONS[token] = pid
            return json_response(self, {'ok': True, 'user': {'business_name': business_name, 'phone': phone}}, cookies_to_set=[make_cookie('partner_session', token)])
        if path == '/api/auth/forgot':
            phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit()); new_password = data.get('new_password','').strip()
            if len(phone) < 10 or len(new_password) < 4:
                return json_response(self, {'error': 'Eksik bilgi.'}, 400)
            conn = db_conn(); cur = conn.cursor(); cur.execute('UPDATE partner_users SET password_hash=? WHERE phone=?', (hash_password(new_password), phone)); conn.commit(); changed = cur.rowcount; conn.close()
            if not changed: return json_response(self, {'error': 'Bu numara bulunamadı.'}, 404)
            return json_response(self, {'ok': True})
        if path == '/api/auth/logout':
            token = load_cookie(self).get('partner_session')
            if token: PARTNER_SESSIONS.pop(token.value, None)
            return json_response(self, {'ok': True}, cookies_to_clear=[make_cookie('partner_session','',0)])

        if path == '/admin-api/auth/login':
            email = data.get('email','').strip().lower(); password = data.get('password','').strip()
            conn = db_conn(); row = conn.execute('SELECT id, email, full_name FROM admin_users WHERE email=? AND password_hash=?', (email, hash_password(password))).fetchone(); conn.close()
            if not row:
                return json_response(self, {'error': 'Email veya şifre yanlış.'}, 401)
            token = secrets.token_hex(16); ADMIN_SESSIONS[token] = row['id']
            return json_response(self, {'ok': True, 'user': {'email': row['email'], 'full_name': row['full_name']}}, cookies_to_set=[make_cookie('admin_session', token)])
        if path == '/admin-api/auth/logout':
            token = load_cookie(self).get('admin_session')
            if token: ADMIN_SESSIONS.pop(token.value, None)
            return json_response(self, {'ok': True}, cookies_to_clear=[make_cookie('admin_session','',0)])

        admin = get_admin(self)
        if path.startswith('/admin-api/') and not path.startswith('/admin-api/auth/'):
            if not admin:
                return json_response(self, {'error': 'Admin girişi gerekli.'}, 401)
            conn = db_conn(); cur = conn.cursor()
            try:
                if path.startswith('/admin-api/partners/') and path.endswith('/approval'):
                    partner_id = int(path.split('/')[3])
                    approval_status = data.get('approval_status', 'pending')
                    note = data.get('note', '').strip()
                    if approval_status not in {'approved', 'pending', 'rejected'}:
                        return json_response(self, {'error': 'Geçersiz onay durumu.'}, 400)
                    cur.execute('UPDATE partner_admin SET approval_status=?, note=?, updated_at=? WHERE partner_user_id=?', (approval_status, note, datetime.now().strftime('%d.%m.%Y %H:%M'), partner_id))
                    conn.commit(); return json_response(self, {'ok': True})
                if path.startswith('/admin-api/partners/') and path.endswith('/visibility'):
                    partner_id = int(path.split('/')[3])
                    visible = 1 if data.get('visible_in_market') else 0
                    cur.execute('UPDATE partner_admin SET visible_in_market=?, updated_at=? WHERE partner_user_id=?', (visible, datetime.now().strftime('%d.%m.%Y %H:%M'), partner_id))
                    conn.commit(); return json_response(self, {'ok': True})
                if path.startswith('/admin-api/partners/') and path.endswith('/plan'):
                    partner_id = int(path.split('/')[3])
                    active = data.get('active_plan', 'none')
                    if active not in {'none', 'daily', 'weekly'}:
                        return json_response(self, {'error': 'Geçersiz plan.'}, 400)
                    days_left = 0 if active == 'none' else 1 if active == 'daily' else 6
                    ends_at = 'Plan seçilmedi' if active == 'none' else (date.today() + timedelta(days=days_left)).strftime('%d %B')
                    cur.execute('UPDATE partner_plan SET active_plan=?, days_left=?, ends_at=? WHERE partner_user_id=?', (active, days_left, ends_at, partner_id))
                    conn.commit(); return json_response(self, {'ok': True})
                if path.startswith('/admin-api/appointments/') and path.endswith('/status'):
                    appointment_id = int(path.split('/')[3])
                    status = data.get('status', 'pending')
                    if status not in {'pending', 'approved', 'rejected', 'cancelled'}:
                        return json_response(self, {'error': 'Geçersiz durum.'}, 400)
                    cur.execute('UPDATE appointments SET status=? WHERE id=?', (status, appointment_id))
                    conn.commit(); return json_response(self, {'ok': True})
            finally:
                conn.close()

        partner = get_partner(self)
        if path.startswith('/api/') and not path.startswith('/api/auth/'):
            if not partner:
                return json_response(self, {'error': 'Partner girişi gerekli.'}, 401)
            pid = partner['id']
            conn = db_conn(); cur = conn.cursor()
            try:
                if path == '/api/profile':
                    clean_phone = ''.join(ch for ch in data.get('phone','') if ch.isdigit())
                    cur.execute('UPDATE partner_profiles SET business_name=?, phone=?, city=?, district=?, address=?, description=? WHERE partner_user_id=?', (data.get('business_name','').strip(), clean_phone, data.get('city','İstanbul'), data.get('district','Beşiktaş'), data.get('address','').strip(), data.get('description','').strip(), pid))
                    cur.execute('UPDATE partner_users SET business_name=?, phone=? WHERE id=?', (data.get('business_name','').strip(), clean_phone, pid))
                    conn.commit(); return json_response(self, {'ok': True})
                if path == '/api/services':
                    name = data.get('name','').strip() or str(data.get('name_text', '')).strip()
                    category = normalize_category(data.get('category','').strip())
                    price = int(data.get('price') or 0)
                    duration = int(data.get('duration') or 0)
                    if not name or not category or price <= 0 or duration <= 0:
                        return json_response(self, {'error': 'Eksik hizmet bilgisi.'}, 400)
                    cur.execute('INSERT INTO partner_services (partner_user_id,name,category,price,duration) VALUES (?,?,?,?,?)', (pid, name, category, price, duration)); conn.commit(); return json_response(self, {'ok': True, 'id': cur.lastrowid})
                if path == '/api/hours':
                    day_name = data.get('day_name')
                    slots = sorted({slot for slot in data.get('slots', []) if slot in TIME_SLOTS})
                    is_open = 1 if slots else 0
                    cur.execute('UPDATE partner_hours SET is_open=?, slot_times=?, start_time=?, end_time=? WHERE partner_user_id=? AND day_name=?', (is_open, json.dumps(slots, ensure_ascii=False), slots[0] if slots else 'Kapalı', slots[-1] if slots else 'Kapalı', pid, day_name)); conn.commit(); return json_response(self, {'ok': True, 'slots': slots})
                if path == '/api/date-slots':
                    slot_date = data.get('slot_date', '').strip()
                    slots = sorted({slot for slot in data.get('slots', []) if slot in TIME_SLOTS})
                    if not slot_date:
                        return json_response(self, {'error': 'Tarih gerekli.'}, 400)
                    is_open = 1 if slots else 0
                    cur.execute('INSERT INTO partner_date_slots (partner_user_id, slot_date, slot_times, is_open, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(partner_user_id, slot_date) DO UPDATE SET slot_times=excluded.slot_times, is_open=excluded.is_open, updated_at=excluded.updated_at', (pid, slot_date, json.dumps(slots, ensure_ascii=False), is_open, datetime.now().strftime('%d.%m.%Y %H:%M')))
                    conn.commit(); return json_response(self, {'ok': True, 'slots': slots, 'day_name': day_name_from_iso(slot_date)})
                if path == '/api/manual-appointments':
                    customer_phone = ''.join(ch for ch in data.get('customer_phone','') if ch.isdigit())
                    service_name = data.get('service_name','').strip()
                    appointment_date = data.get('appointment_date','').strip()
                    time_label = data.get('time_label','').strip()
                    note = data.get('note','').strip()
                    if len(customer_phone) < 10 or not service_name or not appointment_date or not time_label:
                        return json_response(self, {'error': 'Telefon, hizmet, tarih ve saat gerekli.'}, 400)
                    available_slots = effective_slots_for_date(conn, pid, appointment_date)
                    if time_label not in available_slots:
                        return json_response(self, {'error': 'Seçilen gün/saat çalışma planında açık değil.'}, 400)
                    conflict = conn.execute("SELECT 1 FROM appointments WHERE partner_user_id=? AND appointment_date=? AND time_label=? AND status NOT IN ('cancelled','rejected')", (pid, appointment_date, time_label)).fetchone()
                    if conflict:
                        return json_response(self, {'error': 'Bu saat dolu. Başka saat seç.'}, 400)
                    service_row = conn.execute('SELECT price, category FROM partner_services WHERE partner_user_id=? AND name=? ORDER BY id DESC LIMIT 1', (pid, service_name)).fetchone()
                    if not service_row:
                        return json_response(self, {'error': 'Bu hizmet mağazada bulunamadı.'}, 404)
                    customer_row = conn.execute('SELECT id FROM customer_users WHERE phone=?', (customer_phone,)).fetchone()
                    if not customer_row:
                        return json_response(self, {'error': 'Bu telefon numarasıyla kayıtlı bir müşteri bulunamadı.'}, 404)
                    customer_id = customer_row['id']
                    district_row = conn.execute('SELECT district FROM partner_profiles WHERE partner_user_id=?', (pid,)).fetchone()
                    cur.execute('INSERT INTO appointments (customer_user_id, partner_user_id, service_name, category, district, appointment_date, time_label, note, price, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', (customer_id, pid, service_name, service_row['category'], district_row['district'] if district_row else '', appointment_date, time_label, note, int(service_row['price']), 'approved', datetime.now().strftime('%d.%m.%Y %H:%M')))
                    conn.commit(); return json_response(self, {'ok': True})

                if path == '/api/portfolio':
                    title = data.get('title','').strip()
                    category = normalize_category(data.get('category','').strip())
                    image_data = normalize_data_url_image(data.get('image_data',''))
                    if not title or not category or not image_data:
                        return json_response(self, {'error': 'Başlık, kategori ve görsel gerekli.'}, 400)
                    cur.execute('INSERT INTO partner_portfolio (partner_user_id, category, title, image_data, created_at) VALUES (?,?,?,?,?)', (pid, category, title, image_data, datetime.now().strftime('%d.%m.%Y %H:%M')))
                    conn.commit()
                    return json_response(self, {'ok': True, 'id': cur.lastrowid})

                if path == '/api/settings':
                    existing = conn.execute('SELECT email_notifications,message_notifications FROM partner_settings WHERE partner_user_id=?', (pid,)).fetchone()
                    email_notifications = int(data.get('email_notifications', existing['email_notifications']))
                    message_notifications = int(data.get('message_notifications', existing['message_notifications']))
                    cur.execute('UPDATE partner_settings SET email_notifications=?, message_notifications=? WHERE partner_user_id=?', (email_notifications, message_notifications, pid)); conn.commit(); return json_response(self, {'ok': True})
                if path == '/api/plan/purchase':
                    active = data.get('active_plan','weekly')
                    if active not in {'daily','weekly'}: return json_response(self, {'error': 'Geçersiz plan.'}, 400)
                    amount = 150 if active == 'daily' else 910; days_left = 1 if active == 'daily' else 6; ends_at = (date.today() + timedelta(days=days_left)).strftime('%d %B')
                    card_number = ''.join(ch for ch in data.get('card_number','') if ch.isdigit())
                    card_last4 = card_number[-4:] if card_number else ''
                    cur.execute('UPDATE partner_plan SET active_plan=?, days_left=?, ends_at=? WHERE partner_user_id=?', (active, days_left, ends_at, pid))
                    cur.execute('INSERT INTO partner_payments (partner_user_id,plan_type,amount,method,card_last4,created_at,status) VALUES (?,?,?,?,?,?,?)', (pid, active, amount, data.get('method','card'), card_last4, datetime.now().strftime('%d.%m.%Y %H:%M'), 'paid'))
                    conn.commit(); return json_response(self, {'ok': True})
                if path.startswith('/api/appointments/') and path.endswith('/status'):
                    appointment_id = int(path.split('/')[3]); status = data.get('status','pending')
                    if status not in {'pending','approved','rejected'}: return json_response(self, {'error': 'Geçersiz durum.'}, 400)
                    cur.execute('UPDATE appointments SET status=? WHERE id=? AND partner_user_id=?', (status, appointment_id, pid)); conn.commit(); return json_response(self, {'ok': True})
            finally:
                conn.close()

        self.send_error(404)

    def do_PUT(self):
        path = urlparse(self.path).path
        if path.startswith('/customer-api/appointments/'):
            customer = get_customer(self)
            if not customer:
                return json_response(self, {'error': 'Giriş gerekli.'}, 401)
            appointment_id = int(path.split('/')[3])
            data = parse_json_body(self)
            conn = db_conn(); cur = conn.cursor(); cur.execute('UPDATE appointments SET appointment_date=?, time_label=?, status=? WHERE id=? AND customer_user_id=?', (data.get('appointment_date'), data.get('time_range'), 'pending', appointment_id, customer['id'])); conn.commit(); changed = cur.rowcount; conn.close()
            if not changed: return json_response(self, {'error': 'Randevu bulunamadı.'}, 404)
            return json_response(self, {'ok': True})
        self.send_error(404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith('/customer-api/appointments/'):
            customer = get_customer(self)
            if not customer:
                return json_response(self, {'error': 'Giriş gerekli.'}, 401)
            appointment_id = int(path.split('/')[3])
            conn = db_conn(); cur = conn.cursor(); cur.execute('UPDATE appointments SET status=? WHERE id=? AND customer_user_id=?', ('cancelled', appointment_id, customer['id'])); conn.commit(); changed = cur.rowcount; conn.close()
            if not changed: return json_response(self, {'error': 'Randevu bulunamadı.'}, 404)
            return json_response(self, {'ok': True})
        if path.startswith('/api/services/'):
            partner = get_partner(self)
            if not partner:
                return json_response(self, {'error': 'Partner girişi gerekli.'}, 401)
            service_id = int(path.split('/')[3])
            conn = db_conn(); conn.execute('DELETE FROM partner_services WHERE id=? AND partner_user_id=?', (service_id, partner['id'])); conn.commit(); conn.close(); return json_response(self, {'ok': True})
        self.send_error(404)


if __name__ == '__main__':
    init_db()
    server = HTTPServer((HOST, PORT), Handler)
    print(f'BeautyHub connected app with admin running at http://localhost:{PORT}')
    server.serve_forever()
