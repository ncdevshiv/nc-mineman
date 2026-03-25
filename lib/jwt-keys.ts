import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface JwtKeyPaths {
	privKeyPath: string;
	pubKeyPath: string;
}

export function ensureJwtKeys(dataDir: string): JwtKeyPaths {
	mkdirSync(dataDir, { recursive: true });

	const privKeyPath = join(dataDir, 'jwt-private-key.pem');
	const pubKeyPath = join(dataDir, 'jwt-public-key.pem');

	if (existsSync(privKeyPath) && existsSync(pubKeyPath)) {
		const privKey = readFileSync(privKeyPath, 'utf-8').trim();
		const pubKey = readFileSync(pubKeyPath, 'utf-8').trim();
		if (privKey.includes('BEGIN PRIVATE KEY') && pubKey.includes('BEGIN PUBLIC KEY')) {
			return { privKeyPath, pubKeyPath };
		}
		unlinkSync(privKeyPath);
		unlinkSync(pubKeyPath);
	}

	const { privateKey: sec1Key, publicKey } = generateKeyPairSync('ec', {
		namedCurve: 'prime256v1',
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'sec1', format: 'pem' },
	});

	const pkcs8Private = createPrivateKey({ key: sec1Key, format: 'pem', type: 'sec1' }).export({ type: 'pkcs8', format: 'pem' });
	const spkiPublic = createPublicKey({ key: publicKey, format: 'pem' }).export({ type: 'spki', format: 'pem' });

	writeFileSync(privKeyPath, pkcs8Private);
	writeFileSync(pubKeyPath, spkiPublic);

	return { privKeyPath, pubKeyPath };
}
