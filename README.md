# IRFAN OS — Personal Command Center

Dashboard personal untuk mengelola task, goals, habit, career O&G, peluang geofisika, Journal, Analytics, dan War Room.

## Live

- VPS: http://43.156.52.203:18086/IRFAN_OS_Dashboard.html
- Repository: https://github.com/irfan13alawi-lab/my-PA

## Isi proyek

| File | Fungsi |
|------|--------|
| `IRFAN_OS_Dashboard.html` | Dashboard utama dan seluruh modul produktivitas |
| `IRFAN_OS_Opportunities.html` | Tracker peluang publikasi, beasiswa, karier, project, dan kompetisi |
| `deploy/irfan-os-dashboard.service.example` | Template service VPS agar server otomatis restart |

## Fitur

- Today dengan fokus task berdasarkan prioritas dan deadline.
- Habit matrix dengan status kosong, selesai, dan skip.
- Kanban tiga kolom: To Do, In Progress, dan Done.
- Analytics task, habit, goals, dan distribusi kategori.
- War Room dengan status Normal, Alert, Crisis, critical queue, weekly review, dan export report.
- Journal, bookmark Opportunities, task status, tema, dan review tersimpan local-first lalu disinkronkan ke server.
- Task CRUD, drag-and-drop Kanban, filter, prioritas, deadline, reminder, task berulang, bulk complete/delete, dan export.
- Pipeline Opportunities dengan status saved, applied, interview, rejected, accepted, catatan, reminder, import, dan export.
- War Room memakai endpoint AI server-side jika API key dikonfigurasi, dengan fallback lokal yang aman jika belum ada key.
- Dashboard Opportunities dapat dibuka sebagai modul gabungan maupun halaman mandiri.

## Teknologi

- Pure HTML, CSS, dan JavaScript tanpa build tool.
- Node.js server berbasis modul bawaan untuk static files, REST API, JSON database, backup, Basic Auth opsional, dan AI proxy.
- Highcharts dan Chart.js melalui CDN dengan fallback ringkasan data.
- `localStorage` sebagai cache local-first; state utama dapat disinkronkan ke `server/data/state.json`.
- Backup otomatis sebelum setiap perubahan, dengan retensi 30 backup terakhir.

## Update di VPS

```bash
cd ~/irfan-os-dashboard
git pull origin main
```

Untuk membuat server persistent di VPS:

```bash
sudo cp deploy/irfan-os-dashboard.service.example /etc/systemd/system/irfan-os-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable --now irfan-os-dashboard
sudo systemctl status irfan-os-dashboard
```

Service ini memakai Node.js. Pastikan VPS memiliki Node.js 18+ dan hentikan service Python lama sebelum menjalankannya:

```bash
pkill -f "python3 -m http.server 18086" || true
sudo systemctl restart irfan-os-dashboard
curl http://127.0.0.1:18086/api/health
```

Untuk mengaktifkan AI dan Basic Auth, buat file `/etc/irfan-os-dashboard.env` (jangan commit file ini):

```bash
IRFAN_AUTH_USER=owner
IRFAN_AUTH_PASSWORD=ganti-password-kuat
IRFAN_AI_API_KEY=isi-key-di-vps
# opsional: IRFAN_AI_MODEL=gpt-4o-mini
```

Untuk penggunaan publik jangka panjang, letakkan service di belakang Nginx/Caddy dengan domain dan HTTPS.

## Catatan privasi

Repository ini berisi data personal dan rencana karier. Pastikan data yang memang ingin dipublikasikan sudah disanitasi sebelum menambahkan file atau informasi baru. Untuk penggunaan publik jangka panjang, letakkan service di belakang Nginx/Caddy dengan domain dan HTTPS, lalu tutup akses langsung ke port 18086 dari internet.
