export class SheetSource {
  constructor({ sheetId, sheetRange, tokenProvider, fetchFn = fetch }) {
    this.sheetId = sheetId;
    this.sheetRange = sheetRange;
    this.tokenProvider = tokenProvider;
    this.fetchFn = fetchFn;
  }

  async fetchRows() {
    if (!this.sheetId || !this.sheetRange) throw new Error("Google Sheet ID and range are required");
    const token = await this.tokenProvider();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.sheetId)}/values/${encodeURIComponent(this.sheetRange)}?majorDimension=ROWS`;
    const response = await this.fetchFn(url, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Google Sheets request failed with status ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result.values)) throw new Error("Google Sheets response did not contain rows");
    return result.values;
  }
}
