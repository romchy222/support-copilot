// Sites dispatch supplies these headers; the local Sites plugin strips spoofed identity.
export function requestActor(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) throw Object.assign(new Error('Для изменения обращений войдите через ChatGPT'), { status: 401 });
  return { id, name: request.headers.get('oai-authenticated-user-email') || id };
}
