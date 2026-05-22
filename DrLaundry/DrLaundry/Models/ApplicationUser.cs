using Microsoft.AspNetCore.Identity;

namespace DrLaundry.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? EmailVerificationToken { get; set; }
        public bool EmailConfirmed { get; set; }
    }
}
