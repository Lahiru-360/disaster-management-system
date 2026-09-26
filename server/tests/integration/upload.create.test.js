import { jest } from '@jest/globals';
import request from 'supertest';

// CI must never reach a real Supabase bucket. The client is stubbed at the
// `@supabase/supabase-js` boundary — one level below `storage.service.js` —
// so the service's own key-generation and error-translation logic still runs
// for real; only the network call underneath it is replaced.
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

const { default: app } = await import('../../src/app.js');

const validPassword = 'Password123!';

const registerSeeker = async (email) => {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'seeker',
  });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const PNG_MISMATCHED_AS_PDF = { filename: 'photo.pdf', contentType: 'image/png' };
const PDF_MISMATCHED_AS_PNG = { filename: 'document.png', contentType: 'application/pdf' };

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ data: { path: 'stub' }, error: null });
  mockGetPublicUrl.mockReset().mockImplementation((key) => ({
    data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/test-bucket/${key}` },
  }));
});

describe('POST /api/uploads', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .field('folder', 'avatars')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
  });

  it('rejects a file over the 5MB limit with 400 naming the limit', async () => {
    const seeker = await registerSeeker('upload-too-large@example.com');
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .field('folder', 'avatars')
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(res.body.error.message).toMatch(/5\s?MB/i);
  });

  it('rejects a folder outside the closed allow-list with 400 naming the field', async () => {
    const seeker = await registerSeeker('upload-bad-folder@example.com');

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .field('folder', 'not-a-real-folder')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'folder' })]),
    );
  });

  describe('MIME type / extension mismatch, both directions', () => {
    it('rejects a PNG renamed to .pdf', async () => {
      const seeker = await registerSeeker('upload-mismatch-png-as-pdf@example.com');

      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${seeker.accessToken}`)
        .field('folder', 'avatars')
        .attach('file', Buffer.from('fake-image'), PNG_MISMATCHED_AS_PDF);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TYPE_MISMATCH');
    });

    it('rejects a PDF renamed to .png', async () => {
      const seeker = await registerSeeker('upload-mismatch-pdf-as-png@example.com');

      const res = await request(app)
        .post('/api/uploads')
        .set('Authorization', `Bearer ${seeker.accessToken}`)
        .field('folder', 'avatars')
        .attach('file', Buffer.from('fake-document'), PDF_MISMATCHED_AS_PNG);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TYPE_MISMATCH');
    });
  });

  it('surfaces a storage failure as 502 STORAGE_UNAVAILABLE, never a bare 500', async () => {
    const seeker = await registerSeeker('upload-storage-down@example.com');
    mockUpload.mockRejectedValueOnce(new Error('network down'));

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .field('folder', 'avatars')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
  });

  it('stores under a key that is neither the client-supplied filename nor derivable from the user id', async () => {
    const seeker = await registerSeeker('upload-key-shape@example.com');

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .field('folder', 'avatars')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'my-photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    const url = res.body.data.url;

    expect(url).not.toContain('my-photo');
    expect(url).not.toContain(seeker.userId);
    expect(url).toMatch(/\/avatars\/[0-9a-f-]{36}\.png$/);
  });
});
