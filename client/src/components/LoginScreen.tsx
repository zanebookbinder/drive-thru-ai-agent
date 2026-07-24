export function LoginScreen() {
  return (
    <div className="card center">
      <h1>Drive Chat</h1>
      <p className="muted">
        Sign in with Google, paste a Drive folder link, and ask questions about its contents.
        Answers cite their sources and deep-link back into Drive.
      </p>
      <a className="button" href="/auth/google">
        Sign in with Google
      </a>
    </div>
  );
}
