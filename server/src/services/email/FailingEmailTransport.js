import { ApiError } from '../../utils/ApiError.js';
import { EmailTransport } from './EmailTransport.js';

// A demo transport (EMAIL_TRANSPORT=failing): every send fails the way a
// provider outage does, with 502 EMAIL_UNAVAILABLE, and nothing is sent. It lets
// a presenter trigger UC04 E4 (a share that can't be delivered) on purpose, like
// the DEMO_FAIL_* rates do for UC01's channels. It is a transport only: no
// business code knows about it. Every email fails while it is selected, the
// password reset's too.
export class FailingEmailTransport extends EmailTransport {
  send() {
    throw new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.');
  }
}
