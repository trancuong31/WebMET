$(".custom-select").each(function() {
    var classes = $(this).attr("class"),
        id = $(this).attr("id"),
        name = $(this).attr("name");
  
    var template = '<div class="' + classes + '">';
    template += '<span class="custom-select-trigger">--Select an option--</span>';
    template += '<div class="custom-options">';
  
    $(this).find("option").each(function() {
      template += '<span class="custom-option ' + $(this).attr("class") + '" data-value="' + $(this).attr("value") + '">' + $(this).html() + '</span>';
    });
  
    template += '</div></div>';
  
    $(this).wrap('<div class="custom-select-wrapper"></div>');
    $(this).hide();
    $(this).after(template);
  });
  
  $(".custom-option:first-of-type").hover(function() {
    $(this).parents(".custom-options").addClass("option-hover");
  }, function() {
    $(this).parents(".custom-options").removeClass("option-hover");
  });
  
  $(".custom-select-trigger").on("click", function(event) {
    $('html').one('click', function() {
      $(".custom-select").removeClass("opened");
    });

    $(this).parents(".custom-select").toggleClass("opened");
    event.stopPropagation();
  });
  
  $(".custom-option").on("click", function() {
    $(this).parents(".custom-select-wrapper").find("select").val($(this).data("value"));
    $(this).parents(".custom-options").find(".custom-option").removeClass("selection");
    $(this).addClass("selection");
    $(this).parents(".custom-select").removeClass("opened");
    $(this).parents(".custom-select").find(".custom-select-trigger").text($(this).text());
  });

const API_URL = 'http://127.0.0.1:5000/getOptions';

async function loadOptions() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch options');
      }
      const options = await response.json();
      const selectElement = document.getElementById('factory');
      const optionsContainer = document.querySelector('.custom-options');

      optionsContainer.innerHTML = '';
      const addedOptions = new Set();

      options.forEach(option => {
        if (!addedOptions.has(option.factory)) {
          addedOptions.add(option.factory);

          const optionElement = document.createElement('span');
          optionElement.classList.add('custom-option');
          optionElement.textContent = option.factory;
          optionElement.setAttribute('data-value', option.factory);

          optionElement.addEventListener('click', function () {
            selectElement.value = option.factory;
            document.querySelector('.custom-select-trigger').textContent = option.factory;
            optionsContainer.classList.remove('opened');
          });
          optionsContainer.appendChild(optionElement);
        }
      });
    } catch (error) {
      console.error('Error loading options:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', loadOptions);
  