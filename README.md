# PageSpeed Workbench

A static, browser-only PageSpeed Insights dashboard. Enter public URLs, select mobile or desktop, and run an analysis. Each run saves its performance score, lab metrics, and Google's actionable Insights/opportunities in this browser; subsequent runs show the score change. Download any report as a Markdown document, readable in most editors or importable into a document app.

Reports and the optional Google API key are stored in browser local storage on this device and origin. Clearing site data or changing browsers/devices removes access to them; export reports for backup. The key is sent directly to Google, so use a restricted key. Google must be able to access the URLs; authenticated, local, and private pages generally will not work. Google can enforce quotas or require an API key. Results vary between runs. This app does not automatically change your sites.

## Run locally

If the app files are in `dist`, serve them with `python3 -m http.server 8000 --directory dist`. If they are at the repository root, use `python3 -m http.server 8000`. Open http://localhost:8000.

## Free GitHub Pages hosting

If the app files are in `dist`, upload its contents to the root of a public GitHub repository. Then in **Settings → Pages** select **Deploy from a branch**, the default branch, and `/ (root)`. GitHub will display the site URL. The repository and website are public; your report data remains in the browser, not in the repository. GitHub Pages availability and quotas depend on your GitHub plan.

Google API documentation: https://developers.google.com/speed/docs/insights/v5/get-started
# afzaliwp-pagespeed-benchmark
