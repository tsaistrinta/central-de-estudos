FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY pyproject.toml ./
COPY archie ./archie
RUN pip install --no-cache-dir .
RUN useradd --create-home archie
USER archie
CMD ["python", "-m", "archie", "rodar"]
