export function withOpenAppButton(botname: string) {
  return {
    inline_keyboard: [
      [{ text: "启动小程序", url: `https://t.me/${botname}?startapp` }],
    ],
  };
}
