using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using DrLaundry.Helpers;
using DrLaundry.Services.Interfaces;
using Microsoft.Extensions.Logging;

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _settings = config.GetSection("EmailSettings").Get<EmailSettings>()
            ?? throw new Exception("EmailSettings not configured properly");
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        _logger.LogInformation("Preparing to send email to {Recipient} with subject {Subject}", toEmail, subject);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = body };

        using var client = new SmtpClient();

        try
        {
            await client.ConnectAsync(
                _settings.SmtpServer,
                _settings.SmtpPort,
                SecureSocketOptions.StartTls
            );

            await client.AuthenticateAsync(
                _settings.SmtpUser,
                _settings.SmtpPass
            );

            await client.SendAsync(message);
            _logger.LogInformation("Email sent successfully to {Recipient}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Recipient}", toEmail);
            throw; // rethrow so caller knows it failed
        }
        finally
        {
            await client.DisconnectAsync(true);
        }
    }
}
