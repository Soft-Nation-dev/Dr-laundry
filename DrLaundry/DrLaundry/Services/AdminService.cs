using DrLaundry.DTOs;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace DrLaundry.Services
{
    public class AdminService : IAdminService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<AdminService> _logger;

        public AdminService(UserManager<ApplicationUser> userManager, ILogger<AdminService> logger)
        {
            _userManager = userManager;
            _logger = logger;
        }

        // PROMOTE USER TO ADMIN

        public async Task<ApiResponse<string>> MakeAdmin(string email)
        {
            _logger.LogInformation("Admin promotion attempt for {Email}", email);

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Admin promotion failed: User {Email} not found", email);
                return ApiResponse<string>.Fail("User not found");
            }

            var result = await _userManager.AddToRoleAsync(user, "Admin");
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogError("Admin promotion failed for {Email}: {Errors}", email, errors);
                return ApiResponse<string>.Fail(errors);
            }

            _logger.LogInformation("User {Email} promoted to Admin successfully", email);
            return ApiResponse<string>.SuccessResult("User promoted to admin");
        }

        // REMOVE ADMIN ROLE
        
        public async Task<ApiResponse<string>> RemoveAdmin(string email)
        {
            _logger.LogInformation("Admin removal attempt for {Email}", email);

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Admin removal failed: User {Email} not found", email);
                return ApiResponse<string>.Fail("User not found");
            }

            var result = await _userManager.RemoveFromRoleAsync(user, "Admin");
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogError("Admin removal failed for {Email}: {Errors}", email, errors);
                return ApiResponse<string>.Fail(errors);
            }

            _logger.LogInformation("Admin role removed successfully from {Email}", email);
            return ApiResponse<string>.SuccessResult("Admin removed successfully");
        }

        
        // CHECK IF USER IS ADMIN
        
        public async Task<ApiResponse<bool>> IsAdmin(string email)
        {
            _logger.LogInformation("Admin role check for {Email}", email);

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Admin check failed: User {Email} not found", email);
                return ApiResponse<bool>.Fail("User not found");
            }

            var isAdmin = await _userManager.IsInRoleAsync(user, "Admin");

            _logger.LogInformation("Admin role check for {Email}: {IsAdmin}", email, isAdmin);
            return ApiResponse<bool>.SuccessResult(isAdmin);
        }
    }
}
