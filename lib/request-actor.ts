// Sites dispatch supplies these headers; the local Sites plugin strips spoofed identity.
export function requestActor(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  return id ? { id, name: request.headers.get('oai-authenticated-user-email') || id } : null;
}
