FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 XYROPLAY_DB=/var/lib/xyroplay/xyroplay.sqlite3
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 --create-home xyroplay && mkdir -p /var/lib/xyroplay && chown -R xyroplay:xyroplay /var/lib/xyroplay
COPY --chown=xyroplay:xyroplay backend/ ./backend/
COPY --chown=xyroplay:xyroplay web/ ./web/
COPY --chown=xyroplay:xyroplay scripts/backup_db.py /app/scripts/backup_db.py
WORKDIR /app/backend
USER xyroplay
EXPOSE 5000
CMD ["gunicorn","--bind=0.0.0.0:5000","--workers=2","--timeout=30","app:app"]
