import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up only this suite's users. Wiping every user would break
    // other suites that run against the same database and reference
    // their users from adoption/custody rows (FK RESTRICT).
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test@example.com',
            'admin@example.com',
            'login@example.com',
            'me@example.com',
            'logout@example.com',
          ],
        },
      },
    });
  });

  describe('Registration', () => {
    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'StrongPass123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should ignore role escalation attempt via body field role on register', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'StrongPass123',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
        });

      // Should either ignore the role (and create as USER) or reject
      if (res.status === 201) {
        expect(res.body.user.role).not.toBe('ADMIN');
        expect(res.body.user.role).toBe('USER');
      } else {
        expect([400, 403]).toContain(res.status);
      }
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'login@example.com',
        password: 'StrongPass123',
        firstName: 'Login',
        lastName: 'User',
      });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'StrongPass123',
        })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Me endpoint', () => {
    let token: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'me@example.com',
          password: 'StrongPass123',
          firstName: 'Me',
          lastName: 'User',
        });
      token = res.body.access_token;
    });

    it('should get current user with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('email', 'me@example.com');
    });
  });

  describe('Logout', () => {
    let token: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'StrongPass123',
          firstName: 'Logout',
          lastName: 'User',
        });
      token = res.body.access_token;
    });

    it('should logout successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
