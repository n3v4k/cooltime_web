/**
 * 습구온도 근사식 (Stull, 2011)
 * 표준 기압, 상대습도 5~99%, 기온 -20~50℃ 범위에서 유효
 * @param ta 기온 (℃)
 * @param rh 상대습도 (%)
 * @returns 습구온도 (℃)
 */
function getWetBulbTemp(ta: number, rh: number): number {
  return (
    ta * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(ta + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/**
 * 여름철 체감온도를 계산하는 함수 (기상청 체감온도 산출식)
 * Ta: 기온(℃), Tw: 습구온도(℃)
 * 체감온도 = -0.2442 + 0.55399·Tw + 0.45535·Ta – 0.0022·Tw² + 0.00278·Tw·Ta + 3.0
 * @param ta 기온 (℃)
 * @param rh 상대습도 (%)
 * @returns 체감온도 (℃, 소수점 첫째 자리)
 */
export function getSummerWindChill(ta: number, rh: number): number {
  const tw = getWetBulbTemp(ta, rh);

  const feelsLike =
    -0.2442 +
    0.55399 * tw +
    0.45535 * ta -
    0.0022 * Math.pow(tw, 2) +
    0.00278 * tw * ta +
    3.0;

  return Number(feelsLike.toFixed(1));
}
