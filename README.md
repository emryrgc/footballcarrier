# ⚽ Futbolcu Kariyeri (Prototip)

Dikey (portre) ekranda oynanan, 3D futbolcu kariyer oyunu. 17 yaşında bir gençle başla,
maçlarda kritik anları kendin oyna, gelişim puanlarıyla oyuncunu büyüt, transferlerle
Avrupa'ya uzan.

Tarayıcıda çalışır (mobil + masaüstü). Harici model, doku ya da ses dosyası yoktur:
**tüm karakterler, animasyonlar, stadyum dokuları ve sesler kodla üretilir.**

## Çalıştırma

ES modülleri kullandığı için bir yerel sunucu gerekir:

```bash
python3 -m http.server 8000
# sonra: http://localhost:8000
```

Telefonda denemek için bilgisayarla aynı ağdayken `http://<bilgisayar-ip>:8000` adresini aç
ya da repoyu GitHub Pages ile yayınla (ek derleme adımı gerekmez).

## Oynanış

- **Kariyer döngüsü:** Her hafta bir maç. Hafta içinde bir kez antrenman *ya da* dinlenme.
  Enerji, moral ve hoca güveni performansını ve oyuna katılımını etkiler.
- **Maç:** Maç dakika dakika akar; senin oyuncunun dahil olduğu 3–5 kritik anda oyun 3D'ye geçer.
  Senaryolar: kontra atak, hücum organizasyonu, kaleciyle karşı karşıya, kanat atağı, ceza sahası önü.
  Mevkine göre (ST / KOO / KNT) farklı senaryolar daha sık gelir.
- **Reyting:** Gol, asist, isabetli şut, çalım, başarılı pas ve top kayıpları reytingi belirler.
- **Gelişim:** Maç ve antrenmanda puan kazan; Hız, Şut, Pas, Dribling, Fizik'e dağıt (potansiyel sınırı var).
- **Antrenman mini oyunları:** Şut (kaleciye karşı), Çalım (2 savunmacıyı geç), Pas & Bitiricilik.
- **Sezon sonu:** Lig sıralaması, ödüller (şampiyonluk, gol kralı, sezonun oyuncusu), yaşlanma,
  transfer teklifleri. 3 lig: 1. Lig → Süper Lig → Avrupa Elit Ligi. 36 yaşında jübile.
- Kariyer tarayıcıda otomatik kaydedilir (`localStorage`).

## Kontroller

| Eylem | Dokunmatik | Klavye |
|---|---|---|
| Hareket | Sol yarıya dokun-sürükle (joystick) | WASD / Yön tuşları |
| Şut | ŞUT basılı tut (güç) → bırak. Joystick sağ/sol köşe seçer | Space |
| Pas | PAS (mavi halkalı arkadaşa) — önü kapalıysa havadan | J / E |
| Çalım | ÇALIM (makas: kısa koruma + hızlanma) | K / Q |
| Depar | KOŞ basılı tut | Shift |
| Topsuzken | TOP İSTE / MÜDAHALE | J / Space |

## Kod yapısı

```
index.html          Giriş, HUD ve kontrol katmanları
css/style.css       Dikey arayüz stilleri
lib/                three.js (r170, MIT) — yerel kopya
js/main.js          Ekranlar (menü, oyuncu yaratma, kariyer merkezi, gelişim, tablo, sezon sonu) + 3D oyuncu vitrini
js/career.js        Kariyer mantığı: fikstür, maç simülasyonu, puan tablosu, gelişim, transfer, kayıt
js/matchday.js      Maç günü akışı (dakika akışı + 3D anlar), reyting, antrenman seansları
js/moment.js        Oynanabilir 3D pozisyon motoru: top fiziği, şut/pas/çalım/müdahale, kaleci/defans/takım arkadaşı yapay zekası, kamera
js/humanoid.js      Prosedürel insan modeli ve prosedürel animasyonlar (koşu, şut, pas, kayarak müdahale, plonjon, düşme, sevinçler, çalım...)
js/game3d.js        Renderer, stadyum, saha çizgileri, kaleler/file, tribün, top
js/input.js         Sanal joystick, butonlar, klavye
js/audio.js         WebAudio ile üretilen sesler (vuruş, düdük, tribün)
js/hud.js           Maç içi göstergeler
js/data.js          Kurgusal ligler, takımlar, isimler
```
