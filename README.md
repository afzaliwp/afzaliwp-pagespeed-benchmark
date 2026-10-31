# PageSpeed Workbench

A browser-only dashboard for recording Google PageSpeed Insights runs and preparing before-and-after reports for clients and AI coding agents. Website folders are organized by domain, then by URL and device.

## Use it

1. Enter one or more public URLs, choose **Mobile** or **Desktop**, and run PageSpeed before making changes.
2. Make your improvements, then run the exact same URL and device again.
3. Open the website folder and select the desired **Before** and **After** runs. Add a description of the work you completed.
4. Download the **Client report**, open the HTML file, and use **Print / save as PDF** to share it. It compares scores and lab metrics and lists remaining Google insights.
5. Download **AI comparison JSON** and give it to your coding agent. It contains both complete, unchanged PageSpeed API responses, including Lighthouse audit details, resource evidence, and field data when Google provides it. **Selected Google JSON** exports the original response for the selected After run alone.

Only future runs contain the complete Google response. Reports saved by an older version remain available as summary-only reports; their missing original data cannot be recovered. A comparison can include these older runs, but the AI export identifies the missing data.

Reports are stored in IndexedDB in this browser on this device. Notes and the optional Google API key are stored in local storage. Clearing browser data, changing browsers, or moving to a different site address will not carry reports over. Download exports to keep copies; exports cannot currently be imported. Google receives the URL being tested and any API key; use a restricted key. Public report exports can contain URLs or other details returned by Google, so review them before sharing. Google must be able to access the URLs. Private or authenticated pages generally do not work. Google can enforce quotas or require an API key.

The client report uses Lighthouse lab measurements from individual runs; scores vary and do not by themselves prove what caused a change. Google may provide additional field data in its full response. The app does not automatically modify your sites.

## Run locally

Serve this directory over HTTP, for example `python3 -m http.server 8000`, then open http://localhost:8000.

## Publish updates on GitHub Pages

Commit and push the files to the branch configured in **Settings → Pages**. GitHub Pages will publish the updated static site. A public repository is required for GitHub Pages on GitHub Free. Reports and API keys stay in the browser rather than in the repository.

Google API documentation: https://developers.google.com/speed/docs/insights/v5/get-started
