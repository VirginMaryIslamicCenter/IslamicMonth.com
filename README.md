<p align="center">
  <img src="public/assets/og-image.png" alt="IslamicMonth.com – Moon Sighting Visibility Maps" width="700" />
</p>

<h1 align="center">IslamicMonth.com</h1>

<p align="center">
  Crescent moon visibility maps for every Islamic month, powered by the Yallop criterion.
</p>

<p align="center">
  <a href="https://github.com/VirginMaryIslamicCenter/Moon-Sighting-Maps/actions"><img src="https://github.com/VirginMaryIslamicCenter/Moon-Sighting-Maps/actions/workflows/main.yml/badge.svg" alt="Deploy" /></a>
  <a href="https://github.com/VirginMaryIslamicCenter/Moon-Sighting-Maps/blob/main/LICENSE"><img src="https://img.shields.io/github/license/VirginMaryIslamicCenter/Moon-Sighting-Maps" alt="License" /></a>
  <a href="https://angular.dev"><img src="https://img.shields.io/badge/Angular-21-DD0031?logo=angular" alt="Angular 21" /></a>
  <a href="https://d3js.org"><img src="https://img.shields.io/badge/D3.js-7-F9A03C?logo=d3dotjs&logoColor=white" alt="D3.js" /></a>
  <a href="https://islamicmonth.com"><img src="https://img.shields.io/website?url=https%3A%2F%2Fislamicmonth.com&label=islamicmonth.com" alt="Website" /></a>
</p>

---

## About

**IslamicMonth.com** generates interactive world maps showing where the new crescent moon can be sighted on the evening of each Islamic month. Visibility zones are calculated using the **Yallop criterion** and rendered with D3.js on HTML Canvas.

### Features

- **Visibility maps** for every month of the current Islamic year
- **Five visibility categories** — from easily naked-eye visible to not visible
- **Location-aware** — detects your city via browser geolocation or manual search
- **Local sighting info** — shows your personal visibility category and description
- **Responsive** — mobile-first layout with interactive cards
- **Fast** — pure Canvas rendering, ~120 kB gzipped

## Tech Stack

| Layer     | Technology                                     |
| --------- | ---------------------------------------------- |
| Framework | Angular 21 (standalone components, signals)    |
| Maps      | D3.js + HTML Canvas (Natural Earth projection) |
| Geocoding | OpenStreetMap Nominatim                        |
| Styling   | SCSS + Bootstrap 5 (grid only)                 |
| Deploy    | GitHub Actions → IIS                           |

## Getting Started

```bash
# Clone
git clone https://github.com/VirginMaryIslamicCenter/Moon-Sighting-Maps.git
cd Moon-Sighting-Maps

# Install
npm install

# Dev server (http://localhost:4200)
ng serve

# Production build
ng build
```

## Project Structure

```
src/
├── app/
│   ├── components/       # Moon map canvas component
│   ├── pages/            # Home shell & month detail page
│   ├── services/         # Location, moon-data, geocoding services
│   └── models/           # TypeScript interfaces
├── assets/               # Icons, OG image, favicon
└── index.html
```

## License

[MIT](LICENSE) © IslamicMonth.com

---

<p align="center">
  Built with ❤️ by the <a href="https://github.com/VirginMaryIslamicCenter">Virgin Mary Islamic Center</a> team
</p>
