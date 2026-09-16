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

## Fitur

- Today dengan fokus task berdasarkan prioritas dan deadline.
- Habit matrix dengan status kosong, selesai, dan skip.
- Kanban tiga kolom: To Do, In Progress, dan Done.
- Analytics task, habit, goals, dan distribusi kategori.
- War Room dengan status Normal, Alert, Crisis, critical queue, weekly review, dan export report.
- Journal, bookmark Opportunities, task status, tema, dan review tersimpan di browser.
- Dashboard Opportunities dapat dibuka sebagai modul gabungan maupun halaman mandiri.

## Teknologi

- Pure HTML, CSS, dan JavaScript tanpa build tool.
- Highcharts dan Chart.js melalui CDN dengan fallback ringkasan data.
- `localStorage` untuk penyimpanan local-first.
- Tidak ada backend atau database aktif di versi ini.

## Update di VPS

```bash
cd ~/irfan-os-dashboard
git pull origin main
```

Server sebaiknya dijalankan sebagai service persistent (systemd) atau di belakang Nginx/Caddy agar otomatis hidup setelah reboot dan dapat memakai HTTPS.

## Catatan privasi

Repository ini berisi data personal dan rencana karier. Pastikan data yang memang ingin dipublikasikan sudah disanitasi sebelum menambahkan file atau informasi baru.
