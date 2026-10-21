# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- the **Planka API key**, or the **username and password** of a Planka user,
  stored by Gladys in the integration configuration (`secret` fields for the
  key and the password), sent only to the configured Planka address (the key
  in the `X-Api-Key` header, the password to `POST /api/access-tokens`), and
  never logged. The session token Planka answers is kept in memory only;
- under `/data`, only `planka-state.json`: the configured address, the time
  of the last reading and, for each followed card, its id and the id of its
  list (no secret, no card name);
- network: outgoing HTTP(S) requests to the configured Planka address only.
  With "Accept self-signed certificates" ticked, the certificate of that
  address is not verified.

Prefer an API key to a password: it can be revoked in Planka without changing
the password of the user.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Planka itself.
