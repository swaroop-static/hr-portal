import nodemailer from 'nodemailer';
import ical from 'ical-generator';

function generateICS({ title, description, startTime, endTime, location, organizerName, organizerEmail }) {
  const cal = ical({ name: 'HR Portal' });
  cal.createEvent({
    start: new Date(startTime),
    end: endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 60 * 60 * 1000),
    summary: title,
    description,
    location,
    organizer: { name: organizerName || 'HR Portal', email: organizerEmail || FROM.match(/<(.+)>/)?.[1] || 'no-reply@hrportal.com' }
  });
  return cal.toString();
}

// If SMTP env vars are set, use them. Otherwise fall back to console-only mode.
const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const FROM = process.env.SMTP_FROM || 'HR Portal <no-reply@hrportal.com>';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function send(to, subject, html, attachments = []) {
  if (!transporter) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}${attachments.length ? ` | Attachments: ${attachments.map(a => a.filename).join(', ')}` : ''}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html, attachments });
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

export async function sendTestInvite({ candidateName, candidateEmail, candidatePassword, testTitle, testToken, duration }) {
  const link = `${APP_URL}/test/${testToken}`;
  await send(
    candidateEmail,
    `You've been invited to take the ${testTitle} assessment`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Hello ${candidateName},</h2>
      <p>You've been invited to complete an assessment: <strong>${testTitle}</strong> (${duration} minutes).</p>
      <h3>Your login credentials</h3>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;font-weight:bold">Portal URL</td><td style="padding:8px">${APP_URL}/login</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${candidateEmail}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Password</td><td style="padding:8px">${candidatePassword}</td></tr>
      </table>
      <p style="margin-top:24px"><a href="${link}" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Start Assessment →</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">Do not share this link. The test is proctored via webcam and tab-switching will terminate your session.</p>
    </div>`
  );
}

export async function sendApplicationStatusUpdate({ candidateName, candidateEmail, positionTitle, status }) {
  const statusMessages = {
    SELECTED: { subject: '🎉 Congratulations — You have been selected!', body: 'We are pleased to inform you that you have been <strong>selected</strong> for the position.' },
    REJECTED: { subject: 'Update on your application', body: 'After careful consideration, we have decided not to move forward with your application at this time.' },
    IN_PROGRESS: { subject: 'Your application is moving forward', body: 'Great news — your application is progressing to the next stage.' },
  };
  const msg = statusMessages[status];
  if (!msg) return;
  await send(
    candidateEmail,
    `${msg.subject} — ${positionTitle}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Hello ${candidateName},</h2>
      <p>Regarding your application for <strong>${positionTitle}</strong>:</p>
      <p>${msg.body}</p>
      <p style="color:#888;font-size:12px;margin-top:24px">If you have questions, please reach out to your HR contact.</p>
    </div>`
  );
}

export async function sendInterviewInvite({ candidateName, candidateEmail, candidatePassword, interviewerName, interviewerEmail, roundType, positionTitle, interviewLink, scheduledAt }) {
  const typeLabel = { TECHNICAL_INTERVIEW: 'Technical Interview', HR_INTERVIEW: 'HR Interview', FINAL_INTERVIEW: 'Final Interview' }[roundType] || roundType;
  const scheduleText = scheduledAt ? `<p>Scheduled: <strong>${new Date(scheduledAt).toLocaleString()}</strong></p>` : '';

  const attachments = [];
  if (scheduledAt) {
    const icsContent = generateICS({
      title: `${typeLabel} — ${positionTitle}`,
      description: `Interview with ${candidateName}. Join at: ${interviewLink}`,
      startTime: scheduledAt,
      location: interviewLink,
    });
    attachments.push({ filename: 'interview.ics', content: icsContent, contentType: 'text/calendar' });
  }

  await send(
    candidateEmail,
    `Interview invitation: ${typeLabel} — ${positionTitle}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Hello ${candidateName},</h2>
      <p>You have been invited for a <strong>${typeLabel}</strong> for the position of <strong>${positionTitle}</strong>.</p>
      ${scheduleText}
      <h3>Your login credentials</h3>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;font-weight:bold">Portal URL</td><td style="padding:8px">${interviewLink.split('/interview/')[0]}/login</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${candidateEmail}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Password</td><td style="padding:8px">${candidatePassword}</td></tr>
      </table>
      <p style="margin-top:24px"><a href="${interviewLink}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Join Interview Call →</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">Click the button above when the interviewer joins. Audio only — no video required.</p>
    </div>`,
    attachments
  );

  await send(
    interviewerEmail,
    `Interview assigned: ${candidateName} — ${typeLabel}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Hello ${interviewerName},</h2>
      <p>You have been assigned to conduct a <strong>${typeLabel}</strong> for <strong>${candidateName}</strong> applying for <strong>${positionTitle}</strong>.</p>
      ${scheduleText}
      <p style="margin-top:24px"><a href="${interviewLink}" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Start Interview Call →</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">Log in with your portal credentials. The candidate will join the same link.</p>
    </div>`,
    attachments
  );
}

export async function sendProctorInvite({ proctorName, proctorEmail, candidateName, testTitle, proctorLink }) {
  await send(
    proctorEmail,
    `Proctor assignment: ${candidateName} — ${testTitle}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Hello ${proctorName},</h2>
      <p>You have been assigned to proctor <strong>${candidateName}</strong> for the <strong>${testTitle}</strong> assessment.</p>
      <p style="margin-top:24px"><a href="${proctorLink}" style="background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open Proctor View →</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">Log in with your portal credentials to monitor the live session.</p>
    </div>`
  );
}

export async function sendTestSubmittedAlert({ hrEmail, candidateName, testTitle, score }) {
  await send(
    hrEmail,
    `Test submitted: ${candidateName} — ${testTitle}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Test Submission Alert</h2>
      <p><strong>${candidateName}</strong> has submitted the <strong>${testTitle}</strong> assessment.</p>
      ${score !== null ? `<p>Auto-score: <strong>${score}%</strong></p>` : '<p>This test contains written questions that require manual review.</p>'}
      <p><a href="${APP_URL}/hr/applications" style="color:#1e3a5f">View in portal →</a></p>
    </div>`
  );
}

export async function sendNotificationEmail({ to, name, type, title, body, link, emailContext = {} }) {
  const greeting = `<h2>Hello ${name || 'there'},</h2>`;
  const footer = `<p style="color:#888;font-size:12px;margin-top:24px">Log in to the <a href="${APP_URL}" style="color:#1e3a5f">HR Portal</a> for details.</p>`;
  const cta = link
    ? `<p style="margin-top:20px"><a href="${APP_URL}${link}" style="background:#1e3a5f;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold">View in Portal →</a></p>`
    : '';
  const roundLabel = emailContext.roundType
    ? emailContext.roundType.replace(/_/g, ' ').toLowerCase()
    : 'interview';

  if (type === 'ROUND_PASSED') {
    return send(
      to,
      `Round result: Passed ✓ — ${emailContext.positionTitle || 'your application'}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${greeting}
        <p>Great news! Your <strong>${roundLabel}</strong> for <strong>${emailContext.positionTitle || 'the position'}</strong> has been marked as <strong style="color:#059669">passed</strong>.</p>
        <p>The team will be in touch about next steps.</p>
        ${cta}${footer}
      </div>`
    );
  }

  if (type === 'ROUND_FAILED') {
    return send(
      to,
      `Update on your application — ${emailContext.positionTitle || ''}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${greeting}
        <p>Thank you for taking the time to interview for <strong>${emailContext.positionTitle || 'the position'}</strong>.</p>
        <p>After careful review, we will not be moving forward with your application at this stage. We appreciate your effort and wish you the best.</p>
        ${footer}
      </div>`
    );
  }

  if (type === 'ROUND_COMPLETED') {
    return send(
      to,
      `Round completed: ${emailContext.candidateName || 'Candidate'} — ${emailContext.positionTitle || ''}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${greeting}
        <p><strong>${emailContext.candidateName || 'A candidate'}</strong>'s ${roundLabel} for <strong>${emailContext.positionTitle || 'a position'}</strong> has been completed and is ready for review.</p>
        ${cta}${footer}
      </div>`
    );
  }

  if (type === 'ROUND_ASSIGNED' && !emailContext.hasScheduledInvite) {
    return send(
      to,
      `New interview assignment — ${emailContext.positionTitle || ''}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        ${greeting}
        <p>You have been assigned to conduct a <strong>${roundLabel}</strong> for <strong>${emailContext.candidateName || 'a candidate'}</strong> applying for <strong>${emailContext.positionTitle || 'a position'}</strong>.</p>
        <p>The schedule has not been set yet. You will receive another notification once it is confirmed.</p>
        ${cta}${footer}
      </div>`
    );
  }

  // Generic fallback
  return send(
    to,
    title,
    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      ${greeting}<p>${body}</p>${cta}${footer}
    </div>`
  );
}
