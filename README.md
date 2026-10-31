# PageSpeed Workbench

A browser-only dashboard for recording Google PageSpeed Insights runs and preparing before-and-after reports for clients and AI coding agents. Website folders are organized by domain, then by URL and device.

## Use it

1. Enter one or more public URLs and run PageSpeed before making changes. **Both** is selected by default, so every URL is tested on mobile and desktop. You can also select one device.
2. Make your improvements, then run the exact same URL and device again.
3. Open the domain folder to see all pages, with mobile and desktop side by side. Select the desired **Before** and **After** runs for each device, and add a description of the work you completed.
4. Download **Full client report** from the folder to include all of that domain’s pages and devices in one document. Open the HTML file and use **Print / save as PDF** to share it. It compares scores and lab metrics and lists Google insights. Where there is only one run, it is shown as a baseline with no after result.
5. Download **Full AI report (JSON)** from the folder and give it to your coding agent. It includes every saved run for all pages and devices in that folder, including each complete, unchanged PageSpeed API response, Lighthouse audit details, resource evidence, and field data when Google provides it. Individual page/device exports are also available. **Google JSON** exports the original response for the selected After run.

Only future runs contain the complete Google response. Reports saved by an older version remain available as summary-only reports; their missing original data cannot be recovered. A comparison can include these older runs, but the AI export identifies the missing data.

Reports are stored in IndexedDB in this browser on this device. Notes and the optional Google API key are stored in local storage. Clearing browser data, changing browsers, or moving to a different site address will not carry reports over. Download exports to keep copies; exports cannot currently be imported. Google receives the URL being tested and any API key; use a restricted key. Public report exports can contain URLs or other details returned by Google, so review them before sharing. Google must be able to access the URLs. Private or authenticated pages generally do not work. Google can enforce quotas or require an API key.

The client report uses Lighthouse lab measurements from individual runs; scores vary and do not by themselves prove what caused a change. Google may provide additional field data in its full response. The app does not automatically modify your sites.

## Run locally

Serve this directory over HTTP, for example `python3 -m http.server 8000`, then open http://localhost:8000.

## Publish updates on GitHub Pages

Commit and push the files to the branch configured in **Settings → Pages**. GitHub Pages will publish the updated static site. A public repository is required for GitHub Pages on GitHub Free. Reports and API keys stay in the browser rather than in the repository.

Google API documentation: https://developers.google.com/speed/docs/insights/v5/get-started
