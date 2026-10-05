import { notificationService as defaultNotificationService } from '../services/NotificationService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/notifications: the caller's own inbox. Whose items they
// are is decided by the service, from the signed-in user, never from the request.
export class NotificationController extends BaseController {
  #notificationService;

  constructor(notificationService = defaultNotificationService) {
    super();
    this.#notificationService = notificationService;
  }

  async listMine(req, res) {
    const inbox = await this.#notificationService.listForUser(req.user.id, req.query);

    ApiResponse.success(res, inbox, 200);
  }

  async markRead(req, res) {
    const notification = await this.#notificationService.markRead(req.user.id, req.params.id);

    ApiResponse.success(res, { notification }, 200);
  }
}

export const notificationController = new NotificationController();
