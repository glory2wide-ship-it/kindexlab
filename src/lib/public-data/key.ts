/**
 * data.go.kr 일반인증키(Decoding). 보조금24·복지로·국토부 실거래가 등 공통.
 * Encoding 키(%xx)를 넣으면 이중 인코딩으로 실패하므로 Decoding만 사용.
 */
export function dataGoKrServiceKey(): string | undefined {
  const key =
    process.env.DATA_GO_KR_SERVICE_KEY?.trim() ||
    process.env.DATA_GO_KR_API_KEY?.trim() ||
    "";
  return key || undefined;
}

export function hasDataGoKrKey(): boolean {
  return Boolean(dataGoKrServiceKey());
}

/** 기업마당 네이티브 API 키 (bizinfo.go.kr에서 별도 발급). data.go.kr 키와 다름. */
export function bizinfoApiKey(): string | undefined {
  const key = process.env.BIZINFO_API_KEY?.trim() || "";
  return key || undefined;
}
