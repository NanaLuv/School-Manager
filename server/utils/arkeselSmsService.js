// utils/arkeselSmsService.js
const axios = require("axios");

class ArkeselSmsService {
  constructor() {
    this.apiKey = process.env.ARKESEL_API_KEY;
    this.senderId = process.env.ARKESEL_SENDER_ID || "Arkesel";
    this.baseUrl = "https://sms.arkesel.com/api/v2/sms/send";

    console.log("📱 SMS Service Initialized:");
    console.log(
      "   API Key:",
      this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "Missing",
    );
    console.log("   Sender ID:", this.senderId);
  }

  formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.toString().trim().replace(/\s+/g, "");
    if (cleaned.startsWith("0")) cleaned = `233${cleaned.substring(1)}`;
    cleaned = cleaned.replace("+", "");
    if (!cleaned.startsWith("233")) cleaned = `233${cleaned}`;
    return cleaned;
  }

  async sendSMS(phoneNumber, message) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      if (!formattedPhone)
        return { success: false, error: "Invalid phone number" };

      const truncatedMessage =
        message.length > 160 ? message.substring(0, 157) + "..." : message;

      const payload = {
        sender: this.senderId,
        message: truncatedMessage,
        recipients: [formattedPhone],
      };

      console.log("📤 Sending SMS to:", formattedPhone);
      console.log("📤 Using sender:", this.senderId);

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
      });

      console.log("📥 Arkesel response:", response.data);

      if (response.data && response.data.status === "success") {
        return {
          success: true,
          messageId: response.data.data?.[0]?.id || Date.now().toString(),
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: response.data?.message || "Unknown error",
        };
      }
    } catch (error) {
      console.error("Arkesel SMS error details:");
      console.error("  Status:", error.response?.status);
      console.error("  Data:", JSON.stringify(error.response?.data, null, 2));
      console.error("  Message:", error.message);

      const errData = error.response?.data?.message || error.message;
      return { success: false, error: errData };
    }
  }

  async getBalance() {
    try {
      // Correct v2 balance endpoint
      const response = await axios.get(
        "https://sms.arkesel.com/api/v2/clients/balance-details",
        { headers: { "api-key": this.apiKey } },
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status,
      };
    }
  }
}

module.exports = new ArkeselSmsService();
