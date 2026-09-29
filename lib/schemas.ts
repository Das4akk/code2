import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const SendCodeSchema = z.object({
  email: z.string().email({ message: 'Некорректный формат email' }).max(255)
});

export const VerifyCodeSchema = z.object({
  email: z.string().email({ message: 'Некорректный формат email' }).max(255),
  code: z.string().length(6, { message: 'Код должен содержать ровно 6 цифр' }).regex(/^\d{6}$/, { message: 'Код должен состоять только из цифр' }),
  token: z.string().optional()
});

export const ResetPasswordSchema = z.object({
  email: z.string().email({ message: 'Некорректный формат email' }).max(255),
  code: z.string().length(6, { message: 'Код должен содержать ровно 6 цифр' }).regex(/^\d{6}$/, { message: 'Код должен состоять только из цифр' }),
  newPassword: z.string().min(6, { message: 'Пароль должен содержать минимум 6 символов' }).max(128),
  token: z.string().optional()
});

export const ChangeEmailSchema = z.object({
  oldEmail: z.string().email({ message: 'Некорректный формат текущего email' }).max(255),
  newEmail: z.string().email({ message: 'Некорректный формат нового email' }).max(255),
  code: z.string().length(6, { message: 'Код должен содержать ровно 6 цифр' }).regex(/^\d{6}$/, { message: 'Код должен состоять только из цифр' }),
  token: z.string().optional()
});

export const CreatePaymentSchema = z.object({
  plan: z.enum(['basic', 'premium', 'premium_month']).optional(),
  userName: z.string().max(100).optional(),
  email: z.string().email().max(255).optional()
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1, { message: 'Название комнаты не может быть пустым' }).max(100),
  isPrivate: z.boolean().optional()
});

export const SendMessageSchema = z.object({
  text: z.string().min(1, { message: 'Сообщение не может быть пустым' }).max(2000, { message: 'Длина сообщения не должна превышать 2000 символов' })
});

export const VideoInfoSchema = z.object({
  url: z.string().url({ message: 'Некорректный URL видео' }).max(2048)
});

export const VideoSearchSchema = z.object({
  q: z.string().min(1, { message: 'Поисковый запрос не может быть пустым' }).max(200),
  platform: z.string().max(50).optional()
});

export const CheckRoleSchema = z.object({
  uid: z.string().max(128).optional()
});

export const ClaimRoleSchema = z.object({
  secret: z.string().min(1, { message: 'Секретный ключ не может быть пустым' }).max(256),
  role: z.enum(['creator', 'operator', 'manager', 'moderator']).optional()
});

export const ResolveMediaSchema = z.object({
  url: z.string().url({ message: 'Некорректный URL' }).max(2048)
});

/**
 * Express middleware generator to validate request bodies or query params via Zod schema.
 */
export function validate(schema: z.ZodSchema<any>, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dataToValidate = source === 'body' ? req.body : req.query;
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      res.status(400).json({
        success: false,
        error: `Ошибка валидации: ${formattedErrors}`,
        details: result.error.issues
      });
      return;
    }

    if (source === 'body') {
      req.body = result.data;
    } else {
      req.query = result.data;
    }

    next();
  };
}
