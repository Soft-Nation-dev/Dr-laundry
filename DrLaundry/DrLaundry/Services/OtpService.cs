using DrLaundry.Data;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DrLaundry.Services
{
    public class OtpService : IOtpService
    {
        private readonly ApplicationDbContext _context;

        public OtpService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<string> GenerateOtpAsync(string email)
        {
            var code = new Random().Next(100000, 999999).ToString();

            var otp = new EmailOtp
            {
                Email = email,
                Code = code,
                ExpiryTime = DateTime.UtcNow.AddMinutes(10),
                IsUsed = false
            };

            _context.EmailOtps.Add(otp);
            await _context.SaveChangesAsync();

            return code;
        }

        public async Task<bool> VerifyOtpAsync(string email, string code)
        {
            var otp = await _context.EmailOtps
                .Where(x => x.Email == email && x.Code == code && !x.IsUsed)
                .OrderByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            if (otp == null)
                return false;

            if (otp.ExpiryTime < DateTime.UtcNow)
                return false;

            otp.IsUsed = true;
            await _context.SaveChangesAsync();

            return true;
        }
    }
}