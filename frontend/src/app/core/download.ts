import { HttpResponse } from '@angular/common/http';

/** Nazwa pliku z nagłówka Content-Disposition (obsługa filename*= i filename=). */
export function filenameFrom(res: HttpResponse<Blob>, fallback: string): string {
  const h = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(h);
  if (star) { try { return decodeURIComponent(star[1].trim()); } catch { /* użyj filename= */ } }
  const plain = /filename="?([^";]+)"?/i.exec(h);
  return plain ? plain[1].trim() : fallback;
}

/** Zapisuje blob jako plik (tymczasowy link z object URL). */
export function saveBlob(res: HttpResponse<Blob>, fallback: string): void {
  if (!res.body) return;
  const url = URL.createObjectURL(res.body);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFrom(res, fallback);
  a.click();
  URL.revokeObjectURL(url);
}
