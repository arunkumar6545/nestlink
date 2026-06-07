import type { NotificationPayload } from "../types";

export const NOTIFICATION_TYPES = {
  VISITOR_ARRIVAL: "visitor_arrival",
  VISITOR_DEPARTURE: "visitor_departure",
  COMPLAINT_UPDATE: "complaint_update",
  INVOICE_GENERATED: "invoice_generated",
  PAYMENT_SUCCESS: "payment_success",
  NOTICE_CREATED: "notice_created",
  AMENITY_BOOKING_CONFIRMED: "amenity_booking_confirmed",
  RESIDENT_APPROVED: "resident_approved",
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export function buildNotification(
  type: NotificationType,
  payload: Record<string, string>
): NotificationPayload {
  switch (type) {
    case NOTIFICATION_TYPES.VISITOR_ARRIVAL:
      return {
        title: "Visitor Arrived",
        body: `${payload.visitor_name} has checked in at ${payload.time}`,
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.VISITOR_DEPARTURE:
      return {
        title: "Visitor Departed",
        body: `${payload.visitor_name} has checked out`,
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.COMPLAINT_UPDATE:
      return {
        title: "Complaint Updated",
        body: `Your complaint "${payload.title}" is now ${payload.status}`,
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.INVOICE_GENERATED:
      return {
        title: "New Invoice",
        body: `Your maintenance invoice of ₹${payload.amount} for ${payload.period} is ready`,
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
      return {
        title: "Payment Successful",
        body: `Payment of ₹${payload.amount} for ${payload.period} received`,
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.NOTICE_CREATED:
      return {
        title: payload.notice_title,
        body: payload.notice_body.substring(0, 200),
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.AMENITY_BOOKING_CONFIRMED:
      return {
        title: "Booking Confirmed",
        body: `${payload.amenity_name} booked for ${payload.date} at ${payload.slot}`,
        data: { type, ...payload },
      };
    case NOTIFICATION_TYPES.RESIDENT_APPROVED:
      return {
        title: "Welcome to the Society!",
        body: "Your residency has been approved by the admin",
        data: { type, ...payload },
      };
    default:
      return {
        title: "Nestlink",
        body: "You have a new notification",
        data: { type },
      };
  }
}
