using DrLaundry.DTOs;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace DrLaundry.Services
{
    public class AdminService : IAdminService
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public AdminService(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        public async Task<ApiResponse<string>> MakeAdmin(string email)
        {
            var user = await _userManager.FindByEmailAsync(email);

            if (user == null)
                return ApiResponse<string>.Fail("User not found");

            await _userManager.AddToRoleAsync(user, "Admin");

            return ApiResponse<string>.SuccessResult("User promoted to admin");
        }

        public async Task<ApiResponse<string>> RemoveAdmin(string email)
        {
            var user = await _userManager.FindByEmailAsync(email);

            if (user == null)
                return ApiResponse<string>.Fail("User not found");

            await _userManager.RemoveFromRoleAsync(user, "Admin");

            return ApiResponse<string>.SuccessResult("Admin removed successfully");
        }

        public async Task<ApiResponse<bool>> IsAdmin(string email)
        {
            var user = await _userManager.FindByEmailAsync(email);

            if (user == null)
                return ApiResponse<bool>.Fail("User not found");

            var isAdmin = await _userManager.IsInRoleAsync(user, "Admin");

            return ApiResponse<bool>.SuccessResult(isAdmin);
        }
    }
}