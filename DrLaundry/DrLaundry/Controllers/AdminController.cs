using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DrLaundry.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _adminService;

        public AdminController(IAdminService adminService)
        {
            _adminService = adminService;
        }

        // 🔥 Promote user to Admin
        [Authorize(Roles = "Admin")]
        [HttpPost("make-admin")]
        public async Task<IActionResult> MakeAdmin([FromQuery] string email)
        {
            var result = await _adminService.MakeAdmin(email);
            return Ok(result);
        }

        // 🔥 Remove Admin role
        [Authorize(Roles = "Admin")]
        [HttpPost("remove-admin")]
        public async Task<IActionResult> RemoveAdmin([FromQuery] string email)
        {
            var result = await _adminService.RemoveAdmin(email);
            return Ok(result);
        }

        // 🔥 Check if user is admin
        [HttpGet("is-admin")]
        public async Task<IActionResult> IsAdmin([FromQuery] string email)
        {
            var result = await _adminService.IsAdmin(email);
            return Ok(result);
        }
    }
}