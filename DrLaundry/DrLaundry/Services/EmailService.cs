using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using DrLaundry.Helpers;
using DrLaundry.Services.Interfaces;

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;

    public EmailService(IConfiguration config)
    {
        _settings = config.GetSection("EmailSettings").Get<EmailSettings>()
            ?? throw new Exception("EmailSettings not configured properly");
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        var message = new MimeMessage();

        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;

        message.Body = new TextPart("html")
        {
            Text = body
        };

        using var client = new SmtpClient();

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

        await client.DisconnectAsync(true);
    }
}