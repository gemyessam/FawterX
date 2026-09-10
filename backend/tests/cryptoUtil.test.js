// Completely isolate Firebase Admin before requiring any store or routes
const mockFirestoreDb = {
  collection: jest.fn(),
};

jest.mock("../src/services/firebaseAdmin", () => ({
  apps: [{ name: "[DEFAULT]" }],
  firestore: jest.fn(() => mockFirestoreDb),
}));

const {
  encryptSecret,
  decryptSecret,
  getKey,
  getLegacyKey,
  setTestEncryptionKey,
  MIN_KEY_LENGTH,
} = require("../src/utils/cryptoUtil");

const { saveUserSettings, getUserSettings } = require("../src/services/userStatsStore");

describe("cryptoUtil & Settings Security (SEC-01)", () => {
  const TEST_PRIMARY_KEY = "TEST_PRIMARY_SECRET_KEY_EXPLICIT_INJECTION_32CHARS";
  const TEST_LEGACY_KEY = "TEST_LEGACY_SECRET_KEY_EXPLICIT_INJECTION_32CHARS";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.ENCRYPTION_SECRET;
    delete process.env.LEGACY_ENCRYPTION_SECRET;
    setTestEncryptionKey(TEST_PRIMARY_KEY);
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("1. Key Enforcement & Validation", () => {
    it("should throw in all non-test environments if ENCRYPTION_SECRET is absent or under 32 characters", () => {
      process.env.NODE_ENV = "production";
      delete process.env.ENCRYPTION_SECRET;
      expect(() => getKey()).toThrow(/ENCRYPTION_SECRET is required/);

      process.env.ENCRYPTION_SECRET = "too-short";
      expect(() => getKey()).toThrow(new RegExp(`at least ${MIN_KEY_LENGTH} characters`));

      // Also enforce with unset NODE_ENV
      delete process.env.NODE_ENV;
      delete process.env.ENCRYPTION_SECRET;
      expect(() => getKey()).toThrow(/ENCRYPTION_SECRET is required/);
    });

    it("should require explicit key injection or ENCRYPTION_SECRET in test mode (no silent fallback)", () => {
      process.env.NODE_ENV = "test";
      setTestEncryptionKey(null);
      delete process.env.ENCRYPTION_SECRET;

      expect(() => getKey()).toThrow(/ENCRYPTION_SECRET is required/);

      setTestEncryptionKey(TEST_PRIMARY_KEY);
      expect(getKey()).toBeDefined();
    });

    it("should allow explicit test key injection strictly when NODE_ENV === 'test'", () => {
      process.env.NODE_ENV = "production";
      expect(() => setTestEncryptionKey("hack_key_32_characters_minimum__")).toThrow(/strictly when NODE_ENV === 'test'/);
    });

    it("should preserve SHA-256 derivation for key generation", () => {
      const raw = "b".repeat(40);
      setTestEncryptionKey(raw);
      const expectedDigest = require("crypto").createHash("sha256").update(raw).digest();
      expect(getKey()).toEqual(expectedDigest);
    });
  });

  describe("2. Prefix Rejection & Whitespace Encryption (No Bypass)", () => {
    it("should strictly reject caller-supplied secrets starting with 'enc:' prefix", () => {
      expect(() => encryptSecret("enc:gcm:fake:fake:fake")).toThrow(/InvalidSecretFormat/);
      expect(() => encryptSecret("enc:plaintext_attempt")).toThrow(/InvalidSecretFormat/);
    });

    it("should encrypt whitespace-only secrets and never pass them through in plaintext", () => {
      const whitespaceSecret = "   \t\n  ";
      const cipher = encryptSecret(whitespaceSecret);

      expect(cipher.startsWith("enc:gcm:")).toBe(true);
      expect(cipher).not.toBe(whitespaceSecret);
      expect(decryptSecret(cipher)).toBe(whitespaceSecret);

      // Verify whitespace secret triggers key check when key is unconfigured
      setTestEncryptionKey(null);
      delete process.env.ENCRYPTION_SECRET;
      expect(() => encryptSecret(whitespaceSecret)).toThrow(/ENCRYPTION_SECRET is required/);
    });

    it("should throw TypeError on non-string inputs", () => {
      expect(() => encryptSecret(12345)).toThrow(TypeError);
      expect(() => encryptSecret({ secret: "value" })).toThrow(TypeError);
      expect(() => encryptSecret(true)).toThrow(TypeError);
    });

    it("should pass through null, undefined, and exact empty string '' without encryption", () => {
      expect(encryptSecret(null)).toBeNull();
      expect(encryptSecret(undefined)).toBeUndefined();
      expect(encryptSecret("")).toBe("");
    });
  });

  describe("3. Encryption & Decryption Round-Trip", () => {
    it("should encrypt and decrypt plaintext accurately using AES-256-GCM", () => {
      const plain = "SuperSecretETAKey_2026_!@#$%^";
      const cipher = encryptSecret(plain);

      expect(cipher.startsWith("enc:gcm:")).toBe(true);
      const parts = cipher.split(":");
      expect(parts.length).toBe(5);
      expect(parts[2].length).toBe(24); // 12-byte IV in hex
      expect(parts[3].length).toBe(32); // 16-byte GCM tag in hex

      const decrypted = decryptSecret(cipher);
      expect(decrypted).toBe(plain);
    });

    it("should throw and never return plaintext when runtime cipher operation fails", () => {
      const crypto = require("crypto");
      const cipherSpy = jest.spyOn(crypto, "createCipheriv").mockImplementationOnce(() => {
        throw new Error("INJECTED_RUNTIME_CIPHER_FAILURE");
      });

      try {
        expect(() => encryptSecret("secret_probe_text")).toThrow("INJECTED_RUNTIME_CIPHER_FAILURE");
      } finally {
        cipherSpy.mockRestore();
      }
    });
  });

  describe("4. Malformed Ciphertext & Tamper Resistance", () => {
    it("should throw and never return plaintext or ciphertext on tampered auth tag", () => {
      const cipher = encryptSecret("SensitiveData");
      const parts = cipher.split(":");
      // Tamper with tag
      parts[3] = "0".repeat(32);
      const tampered = parts.join(":");

      expect(() => decryptSecret(tampered)).toThrow(/Decryption failed/);
    });

    it("should throw on malformed envelope structure or invalid hex length", () => {
      expect(() => decryptSecret("enc:gcm:invalid")).toThrow(/MalformedEnvelope/);
      expect(() => decryptSecret("enc:unknown:iv:tag:data")).toThrow(/MalformedEnvelope/);
      expect(() => decryptSecret("enc:gcm:tooshortiv:0123456789abcdef0123456789abcdef:data")).toThrow(/MalformedEnvelope/);
    });
  });

  describe("5. Legacy Compatibility & Primary-Key Encryption Proof", () => {
    it("should read unencrypted legacy plaintext without error", () => {
      const legacyPlain = "old_unencrypted_secret_value";
      expect(decryptSecret(legacyPlain)).toBe(legacyPlain);
    });

    it("should read with LEGACY_ENCRYPTION_SECRET fallback, and prove new writes use ONLY primary key", () => {
      // 1. Create ciphertext using legacy key
      setTestEncryptionKey(TEST_LEGACY_KEY);
      const cipherFromLegacy = encryptSecret("LegacyKeyEncryptedData");

      // 2. Set primary key and configure legacy fallback env var
      setTestEncryptionKey(TEST_PRIMARY_KEY);
      process.env.LEGACY_ENCRYPTION_SECRET = TEST_LEGACY_KEY;

      // 3. Fallback decrypt should work
      expect(decryptSecret(cipherFromLegacy)).toBe("LegacyKeyEncryptedData");

      // 4. Create new ciphertext
      const newCipher = encryptSecret("NewDataPrimaryOnly");

      // 5. REMOVE legacy key completely to prove newCipher was encrypted strictly with primary key
      delete process.env.LEGACY_ENCRYPTION_SECRET;
      expect(decryptSecret(newCipher)).toBe("NewDataPrimaryOnly");
    });
  });

  describe("6. Store Integration, Atomicity & Omitted Field Preservation", () => {
    it("should abort with zero writes if second secret fails encryption", async () => {
      let setCalled = false;
      mockFirestoreDb.collection.mockReturnValue({
        doc: () => ({
          set: async () => {
            setCalled = true;
          },
        }),
      });

      await expect(
        saveUserSettings("test-user-id", {
          clientId: "test-client",
          clientSecret1: "valid_secret_1",
          clientSecret2: "enc:forged_prefix_bypass", // Invalid!
        })
      ).rejects.toThrow("فشل معالجة أو حفظ إعدادات الشركة بأمان");

      expect(setCalled).toBe(false);
    });

    it("should abort with zero writes and sanitized logs when runtime cipher fails on second secret", async () => {
      let setCalled = false;
      mockFirestoreDb.collection.mockReturnValue({
        doc: () => ({
          set: async () => {
            setCalled = true;
          },
        }),
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const crypto = require("crypto");

      let cipherCallCount = 0;
      const originalCreateCipheriv = crypto.createCipheriv;
      const cipherSpy = jest.spyOn(crypto, "createCipheriv").mockImplementation((...args) => {
        cipherCallCount++;
        if (cipherCallCount === 2) {
          throw new Error("INJECTED_CIPHER_FAILURE_ON_SECRET_2");
        }
        return originalCreateCipheriv.apply(crypto, args);
      });

      try {
        await expect(
          saveUserSettings("test-user-id", {
            clientId: "test-client",
            clientSecret1: "valid_secret_1",
            clientSecret2: "valid_secret_2",
          })
        ).rejects.toThrow("فشل معالجة أو حفظ إعدادات الشركة بأمان");

        expect(setCalled).toBe(false);
        expect(cipherCallCount).toBe(2);

        // Assert that logs contain [REDACTED] and do NOT leak the injected sensitive error message
        expect(consoleErrorSpy).toHaveBeenCalled();
        for (const call of consoleErrorSpy.mock.calls) {
          const loggedMessage = call.join(" ");
          expect(loggedMessage).not.toContain("INJECTED_CIPHER_FAILURE_ON_SECRET_2");
          expect(loggedMessage).toContain("[REDACTED]");
        }
      } finally {
        cipherSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });

    it("should skip empty companySettings write when input contains only undefined secrets", async () => {
      let savedData = null;
      mockFirestoreDb.collection.mockReturnValue({
        doc: () => ({
          set: async (data) => {
            savedData = data;
          },
        }),
      });

      // Pass payload with only undefined secrets
      await saveUserSettings("test-user-id", {
        clientSecret1: undefined,
        clientSecret2: undefined,
      });

      expect(savedData).toBeDefined();
      expect("companySettings" in savedData).toBe(false); // Proves no empty map `{}` was written!
    });

    it("should omit undefined secrets and explicitly set cleared secrets to null", async () => {
      let savedSettings = null;
      mockFirestoreDb.collection.mockReturnValue({
        doc: () => ({
          set: async (data) => {
            savedSettings = data.companySettings;
          },
        }),
      });

      // Clear secret1 (''), omit secret2 (undefined)
      await saveUserSettings("test-user-id", {
        clientId: "client-123",
        clientSecret1: "",
      });

      expect(savedSettings.clientSecret1).toBeNull();
      expect("clientSecret2" in savedSettings).toBe(false);
    });

    it("should redact logs and never leak secret material or raw exception stack", async () => {
      const sensitiveSecret = "SUPER_SECRET_VALUE_NEVER_LEAK_998877";
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      try {
        await expect(
          saveUserSettings("test-user-id", {
            clientId: "client",
            clientSecret1: `enc:${sensitiveSecret}`,
          })
        ).rejects.toThrow("فشل معالجة أو حفظ إعدادات الشركة بأمان");

        expect(consoleErrorSpy).toHaveBeenCalled();
        for (const call of consoleErrorSpy.mock.calls) {
          const loggedString = call.join(" ");
          expect(loggedString).not.toContain(sensitiveSecret);
          expect(loggedString).not.toContain("OpenSSL");
          expect(loggedString).not.toContain("InvalidSecretFormat");
          expect(loggedString).toContain("[REDACTED]");
        }
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it("should fail safely on getUserSettings when stored ciphertext is tampered", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockFirestoreDb.collection.mockReturnValue({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              companySettings: {
                clientId: "client-id",
                clientSecret1: "enc:gcm:0123456789abcdef01234567:0123456789abcdef0123456789abcdef:corrupt",
              },
            }),
          }),
        }),
      });

      try {
        await expect(getUserSettings("test-user-id")).rejects.toThrow("فشل استرجاع إعدادات الشركة بأمان");
        expect(consoleErrorSpy).toHaveBeenCalled();
        for (const call of consoleErrorSpy.mock.calls) {
          expect(call.join(" ")).toContain("[REDACTED]");
        }
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe("7. ETA Settings Route Sanitized Error Handling", () => {
    it("should return sanitized error without secret leakage on route failure", async () => {
      const etaRouter = require("../src/routes/eta");
      // Find POST /settings handler
      const postSettingsLayer = etaRouter.stack.find(
        (l) => l.route && l.route.path === "/settings" && l.route.methods.post
      );
      expect(postSettingsLayer).toBeDefined();

      const handler = postSettingsLayer.route.stack[0].handle;
      const req = {
        user: { uid: "user-test" },
        body: {
          clientId: "client-test",
          clientSecret1: "enc:leak_probe_secret_12345",
        },
      };

      let responseStatus = null;
      let responseJson = null;
      const res = {
        status: (code) => {
          responseStatus = code;
          return res;
        },
        json: (data) => {
          responseJson = data;
          return res;
        },
      };

      await handler(req, res);
      expect(responseStatus).toBe(500);
      expect(responseJson.success).toBe(false);
      expect(responseJson.message).toBe("فشل حفظ إعدادات الشركة بأمان");
      expect(JSON.stringify(responseJson)).not.toContain("leak_probe_secret");
    });
  });
});
