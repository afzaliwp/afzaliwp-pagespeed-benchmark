# PageSpeed Workbench

A browser-only dashboard for recording Google PageSpeed Insights runs and preparing before-and-after reports for clients and AI coding agents. Website folders are organized by domain, then by URL and device.

## Use it

1. Enter one or more public URLs and run PageSpeed before making changes. **Both** is selected by default, so every URL is tested on mobile and desktop. You can also select one device.
2. Make your improvements, then run the exact same URL and device again.
3. Open the domain folder to see all pages, with mobile and desktop side by side. Select the desired **Before** and **After** runs for each device, and add a description of the work you completed.
4. Download **Full client report** from the folder to include all of that domain’s pages and devices in one document. Open the Persian, right-to-left HTML report and use **چاپ یا ذخیره به صورت PDF** to share it. Color-coded scores compare lab measurements and selected client-friendly insights. The report displays «نتایج پس از بهینه سازی در اینجا قرار خواهد گرفت» when no after run is available. The full technical details remain in the AI export.
5. Download **Full AI report (JSON)** from the folder and give it to your coding agent. It includes every saved run for all pages and devices in that folder, including each complete, unchanged PageSpeed API response, Lighthouse audit details, resource evidence, and field data when Google provides it. Individual page/device exports are also available. **Google JSON** exports the original response for the selected After run.

## Optional Lighthouse reports

Select **Include full Lighthouse categories** before a new run to request accessibility, best practices, and SEO alongside performance. This option uses the PageSpeed Insights API; it does not launch a separate local Lighthouse run. In a page’s mobile or desktop section, select the saved runs and use **Lighthouse before** or **Lighthouse after** to download each selected Lighthouse result as a separate JSON file. Open the file in [Google’s Lighthouse Viewer](https://googlechrome.github.io/lighthouse/viewer/) to see the visual Lighthouse report. Older summary-only runs cannot be exported this way; older full-response runs contain only the categories originally requested.

Only future runs contain the complete Google response. Reports saved by an older version remain available as summary-only reports; their missing original data cannot be recovered. A comparison can include these older runs, but the AI export identifies the missing data.

Reports are stored in IndexedDB in this browser on this device. Notes and the optional Google API key are stored in local storage. Clearing browser data, changing browsers, or moving to a different site address will not carry reports over. Download exports to keep copies; exports cannot currently be imported. Google receives the URL being tested and any API key; use a restricted key. Public report exports can contain URLs or other details returned by Google, so review them before sharing. Google must be able to access the URLs. Private or authenticated pages generally do not work. Google can enforce quotas or require an API key.

The client report uses Lighthouse lab measurements from individual runs; scores vary and do not by themselves prove what caused a change. Google may provide additional field data in its full response. The app does not automatically modify your sites.

## Run locally

Serve this directory over HTTP, for example `python3 -m http.server 8000`, then open http://localhost:8000.

## Publish updates on GitHub Pages

Commit and push the files to the branch configured in **Settings → Pages**. GitHub Pages will publish the updated static site. A public repository is required for GitHub Pages on GitHub Free. Reports and API keys stay in the browser rather than in the repository.

Google API documentation: https://developers.google.com/speed/docs/insights/v5/get-started

## Custom Persian client report

Use **ساخت گزارش نهایی مشتری** to enter a report title, client, your own text, and any number of scores. Give each score a descriptive title, a number from 0 to 100, an optional PageSpeed report link, and optional notes. Add your name and contact details, then download the Persian HTML report and open it to print or save as PDF. The builder works independently of saved Google runs and does not verify the manually entered scores. Its draft is saved in this browser's local storage; download the report to keep a copy.
