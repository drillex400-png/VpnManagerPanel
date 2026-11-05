/**
 * Generate a real VLESS+Reality share URL.
 * Format: vless://uuid@host:port?type=tcp&security=reality&pbk=KEY&fp=chrome&sni=HOST&sid=ID&spx=%2F&flow=xtls-rprx-vision#NAME
 */
export function generateVlessUrl(params: {
  uuid: string;
  host: string;
  port: number;
  publicKey: string;
  sni: string;
  shortId: string;
  flow: string;
  name: string;
}): string {
  const { uuid, host, port, publicKey, sni, shortId, flow, name } = params;

  const queryParams = new URLSearchParams({
    type: 'tcp',
    security: 'reality',
    pbk: publicKey,
    fp: 'chrome',
    sni,
    sid: shortId,
    spx: '/',
    flow,
  });

  return `vless://${uuid}@${host}:${port}?${queryParams.toString()}#${encodeURIComponent(name)}`;
}
