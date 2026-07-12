import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ALG = "HS256";

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  username: string;
}

export async function signAccessToken(claims: {
  sub: string;
  username: string;
}): Promise<string> {
  return new SignJWT({ username: claims.username })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret());
  return payload as AccessTokenClaims;
}

export async function signRefreshToken(claims: { sub: string }): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, secret());
  if (payload.type !== "refresh") throw new Error("not a refresh token");
  return { sub: payload.sub ?? "" };
}
